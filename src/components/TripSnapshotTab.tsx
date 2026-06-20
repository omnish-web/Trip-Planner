import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Download, ChevronDown, ChevronUp, Paperclip } from 'lucide-react'
import jsPDF from 'jspdf'
import { toast } from 'react-hot-toast'

interface TripSnapshotTabProps {
    trip: any
    expenses: any[]
    participants: any[]
    getParticipantName: (id: string) => string
    balances: {
        participantId: string
        amount: number
        name: string
    }[]
    settlements: {
        from: string
        to: string
        amount: number
    }[]
    currency: string
}

const getCategoryStyles = (category: string) => {
    switch (category) {
        case 'Food':
            return {
                icon: '🍔',
                colorClass: 'bg-orange-100 text-orange-600',
                barColor: 'bg-orange-500'
            }
        case 'Transport':
            return {
                icon: '✈️',
                colorClass: 'bg-blue-100 text-blue-600',
                barColor: 'bg-blue-500'
            }
        case 'Accommodation':
            return {
                icon: '🏨',
                colorClass: 'bg-purple-100 text-purple-600',
                barColor: 'bg-purple-500'
            }
        case 'Entertainment':
            return {
                icon: '🎉',
                colorClass: 'bg-pink-100 text-pink-600',
                barColor: 'bg-pink-500'
            }
        default:
            return {
                icon: '💸',
                colorClass: 'bg-gray-100 text-gray-600',
                barColor: 'bg-gray-400'
            }
    }
}

export default function TripSnapshotTab({
    trip,
    expenses,
    participants,
    currency,
    getParticipantName,
    settlements,
    balances
}: TripSnapshotTabProps) {

    const [expandedExpenses, setExpandedExpenses] = useState<Set<string>>(new Set())

    const toggleExpense = (id: string) => {
        setExpandedExpenses(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    // Calculate Trip Summary
    const validExpenses = expenses.filter(e => e.category !== 'Settlement' && e.title !== 'Settlement')
    const totalCost = validExpenses.reduce((sum, e) => sum + e.amount, 0)
    const startDate = trip.start_date ? format(parseISO(trip.start_date), 'MMM d, yyyy') : 'TBD'
    const endDate = trip.end_date ? format(parseISO(trip.end_date), 'MMM d, yyyy') : 'TBD'
    const duration = trip.start_date && trip.end_date
        ? Math.ceil((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
        : 1

    // Calculate amount paid by each participant (excluding settlements)
    const amountPaidByParticipant: Record<string, number> = {}
    participants.forEach(p => amountPaidByParticipant[p.id] = 0)
    validExpenses.forEach(expense => {
        const payers = expense.expense_payers || []
        if (payers.length > 0) {
            payers.forEach((p: any) => {
                amountPaidByParticipant[p.participant_id] = (amountPaidByParticipant[p.participant_id] || 0) + p.amount
            })
        } else if (expense.paid_by) {
            amountPaidByParticipant[expense.paid_by] = (amountPaidByParticipant[expense.paid_by] || 0) + expense.amount
        }
    })

    // Calculate each participant's share of trip expenses (from splits)
    const shareOfExpenses: Record<string, number> = {}
    participants.forEach(p => shareOfExpenses[p.id] = 0)
    validExpenses.forEach(expense => {
        const splits = expense.expense_splits || []
        splits.forEach((split: any) => {
            shareOfExpenses[split.participant_id] = (shareOfExpenses[split.participant_id] || 0) + split.amount
        })
    })

    // Group expenses by date for day-wise report
    const expensesByDate: Record<string, any[]> = {}
    expenses.forEach(expense => {
        const date = expense.date
        if (!expensesByDate[date]) {
            expensesByDate[date] = []
        }
        expensesByDate[date].push(expense)
    })

    // Sort dates chronologically (oldest first); within each day sort by time descending (no time → last)
    const sortedDates = Object.keys(expensesByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    sortedDates.forEach(date => {
        expensesByDate[date].sort((a, b) => {
            if (!a.expense_time && !b.expense_time) return 0
            if (!a.expense_time) return 1
            if (!b.expense_time) return -1
            return a.expense_time.localeCompare(b.expense_time)
        })
    })

    // Separate parents and children for member listing
    const parentMembers = participants.filter(p => !p.parent_id)
    const getChildren = (parentId: string) => participants.filter(p => p.parent_id === parentId)

    // Calculate cumulative balances up to and including a given date
    const getBalancesUpToDate = (upToDateIndex: number) => {
        const balancesMap: Record<string, number> = {}
        participants.forEach(p => balancesMap[p.id] = 0)

        // Process expenses from day 0 to upToDateIndex
        for (let i = 0; i <= upToDateIndex; i++) {
            const date = sortedDates[i]
            const dayExpenses = expensesByDate[date] || []

            dayExpenses.forEach(expense => {
                const splits = expense.expense_splits || []
                const payers = expense.expense_payers || []

                // Credit each payer with the amount they actually paid
                if (payers.length > 0) {
                    payers.forEach((payer: any) => {
                        balancesMap[payer.participant_id] = (balancesMap[payer.participant_id] || 0) + payer.amount
                    })
                } else if (expense.paid_by) {
                    // Fallback for single payer (legacy support)
                    balancesMap[expense.paid_by] = (balancesMap[expense.paid_by] || 0) + expense.amount
                }

                // Debtors get -splitAmount
                splits.forEach((split: any) => {
                    balancesMap[split.participant_id] = (balancesMap[split.participant_id] || 0) - split.amount
                })
            })
        }

        // Convert to list and calculate settlements
        const balancesList = Object.entries(balancesMap).map(([id, amount]) => {
            const p = participants.find(p => p.id === id)
            return {
                participantId: id,
                name: p?.profiles?.full_name || p?.name || p?.profiles?.email || 'Unknown',
                amount
            }
        }).filter(b => Math.abs(b.amount) > 0.01).sort((a, b) => b.amount - a.amount)

        // Calculate who owes whom (simplified settlement)
        const debtors = balancesList.filter(b => b.amount < -0.01).map(b => ({ ...b }))
        const creditors = balancesList.filter(b => b.amount > 0.01).map(b => ({ ...b }))

        const daySettlements: { from: string, to: string, amount: number }[] = []
        let d = 0, c = 0

        while (d < debtors.length && c < creditors.length) {
            const debtor = debtors[d]
            const creditor = creditors[c]
            const amount = Math.min(Math.abs(debtor.amount), creditor.amount)

            daySettlements.push({ from: debtor.name, to: creditor.name, amount })

            debtor.amount += amount
            creditor.amount -= amount

            if (Math.abs(debtor.amount) < 0.01) d++
            if (creditor.amount < 0.01) c++
        }

        return { balances: balancesList, settlements: daySettlements }
    }

    // Category Data for chart
    const categoryData = (() => {
        const stats: Record<string, number> = {}
        expenses.forEach(e => {
            stats[e.category] = (stats[e.category] || 0) + e.amount
        })
        return Object.entries(stats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
    })()

    const handleDownloadPDF = async () => {
        try {
            toast.loading('Generating PDF...', { id: 'pdf-toast' })

            const pdf = new jsPDF('p', 'mm', 'a4')
            const pageWidth = pdf.internal.pageSize.getWidth()
            const pageHeight = pdf.internal.pageSize.getHeight()
            const margin = 15
            const contentWidth = pageWidth - (margin * 2)
            let y = margin

            // Helper function to check page break
            const checkPageBreak = (neededHeight: number) => {
                if (y + neededHeight > pageHeight - margin) {
                    pdf.addPage()
                    y = margin
                    return true
                }
                return false
            }

            // Helper to draw horizontal line
            const drawLine = () => {
                pdf.setDrawColor(200, 200, 200)
                pdf.setLineWidth(0.3)
                pdf.line(margin, y, pageWidth - margin, y)
                y += 3
            }

            // ============ HEADER ============
            pdf.setFontSize(22)
            pdf.setFont('helvetica', 'bold')
            pdf.setTextColor(30, 30, 30)
            pdf.text(trip.title, pageWidth / 2, y, { align: 'center' })
            y += 7

            pdf.setFontSize(10)
            pdf.setFont('helvetica', 'normal')
            pdf.setTextColor(100, 100, 100)
            pdf.text(`${startDate} - ${endDate}`, pageWidth / 2, y, { align: 'center' })
            y += 8
            drawLine()
            y += 4

            // ============ TRIP SUMMARY ============
            pdf.setFontSize(12)
            pdf.setFont('helvetica', 'bold')
            pdf.setTextColor(30, 30, 30)
            pdf.text('TRIP SUMMARY', margin, y)
            y += 6

            pdf.setFontSize(10)
            pdf.setFont('helvetica', 'normal')
            pdf.setTextColor(60, 60, 60)
            pdf.text(`Total Cost: ${currency} ${totalCost.toLocaleString()}   |   Duration: ${duration} Day${duration > 1 ? 's' : ''}   |   Members: ${participants.length}`, margin, y)
            y += 8
            drawLine()
            y += 4

            y += 5

            // ============ CATEGORY SPLIT (MOVED UP) ============
            pdf.setFontSize(12)
            pdf.setFont('helvetica', 'bold')
            pdf.setTextColor(30, 30, 30)
            pdf.text('CATEGORY SPLIT', margin, y)
            y += 6

            if (categoryData.length === 0) {
                pdf.setFontSize(10)
                pdf.setFont('helvetica', 'normal')
                pdf.setTextColor(100, 100, 100)
                pdf.text('No expenses recorded yet.', pageWidth / 2, y, { align: 'center' })
                y += 8
            } else {
                // Table header
                pdf.setFontSize(9)
                pdf.setFont('helvetica', 'bold')
                pdf.setTextColor(80, 80, 80)
                pdf.text('Category', margin + 5, y)
                pdf.text('Amount', margin + 80, y)
                pdf.text('Percentage', margin + 120, y)
                y += 5

                categoryData.forEach((cat, idx) => {
                    const percentage = totalCost > 0 ? (cat.value / totalCost) * 100 : 0

                    pdf.setFont('helvetica', 'normal')
                    pdf.setTextColor(50, 50, 50)
                    pdf.text(`${idx + 1}. ${cat.name}`, margin + 5, y)

                    pdf.setFont('helvetica', 'bold')
                    pdf.setTextColor(40, 80, 180)
                    pdf.text(`${currency} ${cat.value.toLocaleString()}`, margin + 80, y)

                    pdf.setFont('helvetica', 'normal')
                    pdf.setTextColor(100, 100, 100)
                    pdf.text(`${percentage.toFixed(1)}%`, margin + 120, y)
                    y += 5
                })
            }

            y += 4
            drawLine()
            y += 4

            // ============ MEMBERS TABLE ============
            pdf.setFontSize(12)
            pdf.setFont('helvetica', 'bold')
            pdf.setTextColor(30, 30, 30)
            pdf.text('MEMBERS', margin, y)
            y += 6

            // Table header
            pdf.setFontSize(9)
            pdf.setFont('helvetica', 'bold')
            pdf.setTextColor(80, 80, 80)
            pdf.setFillColor(245, 245, 245)
            pdf.rect(margin, y - 4, contentWidth, 6, 'F')
            pdf.text('#', margin + 3, y)
            pdf.text('Name', margin + 12, y)
            pdf.text('Role', margin + 80, y)
            pdf.text('Amount Paid', margin + contentWidth - 30, y, { align: 'right' })
            y += 6

            // Table rows
            pdf.setFont('helvetica', 'normal')
            pdf.setTextColor(50, 50, 50)
            let memberIndex = 1
            parentMembers.forEach(parent => {
                const parentName = parent.profiles?.full_name || parent.name || parent.profiles?.email || 'Unknown'
                const amountPaid = amountPaidByParticipant[parent.id] || 0

                pdf.setFont('helvetica', 'bold')
                pdf.text(`${memberIndex}`, margin + 3, y)
                pdf.text(parentName, margin + 12, y)
                pdf.setFont('helvetica', 'normal')
                pdf.text('Parent', margin + 80, y)
                pdf.text(`${currency} ${amountPaid.toLocaleString()}`, margin + contentWidth - 30, y, { align: 'right' })
                y += 5

                // Children under this parent
                const children = getChildren(parent.id)
                children.forEach(child => {
                    const childName = child.profiles?.full_name || child.name || child.profiles?.email || 'Unknown'
                    const childAmountPaid = amountPaidByParticipant[child.id] || 0

                    pdf.setTextColor(100, 100, 100)
                    pdf.text(`    -`, margin + 6, y)
                    pdf.text(childName, margin + 18, y)
                    pdf.text('Child', margin + 80, y)
                    pdf.text(`${currency} ${childAmountPaid.toLocaleString()}`, margin + contentWidth - 30, y, { align: 'right' })
                    pdf.setTextColor(50, 50, 50)
                    y += 5
                })

                memberIndex++
            })

            y += 4
            drawLine()
            y += 4

            // ============ FINAL COST PER MEMBER (NEW DESIGN) ============
            // checkPageBreak(40) // Removed to force start on Page 1 if possible
            pdf.setFontSize(12)
            pdf.setFont('helvetica', 'bold')
            pdf.setTextColor(30, 30, 30)
            pdf.text('FINAL COST PER MEMBER', margin, y)
            y += 5
            pdf.setFontSize(8)
            pdf.setFont('helvetica', 'normal')
            pdf.setTextColor(100, 100, 100)
            pdf.text('Each member\'s share of trip expenses with category-wise breakdown', margin, y)
            y += 8

            parentMembers.forEach(parent => {
                const parentName = parent.profiles?.full_name || parent.name || parent.profiles?.email || 'Unknown'
                const parentShare = shareOfExpenses[parent.id] || 0
                const parentBalance = balances.find((b: any) => b.participantId === parent.id)?.amount || 0
                const isSettled = Math.abs(parentBalance) < 0.01

                const children = getChildren(parent.id)

                // Skip if parent and all children have 0 share
                if (parentShare === 0 && children.every(child => (shareOfExpenses[child.id] || 0) === 0)) {
                    return
                }

                // Check page break for Parent Block (estimate height)
                // checkPageBreak(30) // Minimized check

                // Parent Header
                pdf.setFontSize(10)
                pdf.setFont('helvetica', 'bold')
                pdf.setTextColor(40, 40, 40)
                pdf.text(parentName, margin + 2, y)

                // Parent Share & %
                const percentage = totalCost > 0 ? ((parentShare / totalCost) * 100).toFixed(1) : '0.0'
                pdf.text(`${currency} ${parentShare.toFixed(0)}`, margin + contentWidth - 30, y, { align: 'right' })

                pdf.setFontSize(9)
                pdf.setFont('helvetica', 'normal')
                pdf.setTextColor(100, 100, 100)
                pdf.text(`${percentage}%`, margin + contentWidth - 5, y, { align: 'right' })

                if (isSettled) {
                    pdf.setTextColor(34, 197, 94) // Green
                    pdf.setFontSize(8)
                    pdf.text('(Settled)', margin + 60, y)
                }

                y += 6

                // Parent Categories
                const parentCategorySpend: Record<string, number> = {}
                validExpenses.forEach(expense => {
                    const splits = expense.expense_splits || []
                    const parentSplit = splits.find((s: any) => s.participant_id === parent.id)
                    if (parentSplit) {
                        parentCategorySpend[expense.category] = (parentCategorySpend[expense.category] || 0) + parentSplit.amount
                    }
                })
                const parentCategories = Object.entries(parentCategorySpend).sort((a, b) => b[1] - a[1])

                if (parentCategories.length > 0) {
                    parentCategories.forEach(([cat, amount]) => {
                        checkPageBreak(5)
                        pdf.setFontSize(9)
                        pdf.setFont('helvetica', 'normal')
                        pdf.setTextColor(100, 100, 100) // Gray
                        pdf.text(`- ${cat}`, margin + 8, y)
                        pdf.text(`${currency} ${amount.toFixed(0)}`, margin + contentWidth - 30, y, { align: 'right' })
                        y += 4
                    })
                }
                y += 2

                // Children
                children.forEach(child => {
                    const childName = child.profiles?.full_name || child.name || child.profiles?.email || 'Unknown'
                    const childShare = shareOfExpenses[child.id] || 0
                    const childBalance = balances.find((b: any) => b.participantId === child.id)?.amount || 0
                    const childIsSettled = Math.abs(childBalance) < 0.01

                    if (childShare === 0) return

                    checkPageBreak(15)

                    // Child Header
                    y += 2
                    pdf.setFontSize(9)
                    pdf.setFont('helvetica', 'bold')
                    pdf.setTextColor(80, 80, 80)
                    pdf.text(childName, margin + 12, y) // Indented

                    pdf.text(`${currency} ${childShare.toFixed(0)}`, margin + contentWidth - 30, y, { align: 'right' })

                    if (childIsSettled) {
                        pdf.setTextColor(34, 197, 94)
                        pdf.setFontSize(8)
                        pdf.text('(Settled)', margin + 60, y)
                    }
                    y += 5

                    // Child Categories
                    const childCategorySpend: Record<string, number> = {}
                    validExpenses.forEach(expense => {
                        const splits = expense.expense_splits || []
                        const childSplit = splits.find((s: any) => s.participant_id === child.id)
                        if (childSplit) {
                            childCategorySpend[expense.category] = (childCategorySpend[expense.category] || 0) + childSplit.amount
                        }
                    })
                    const childCategories = Object.entries(childCategorySpend).sort((a, b) => b[1] - a[1])

                    if (childCategories.length > 0) {
                        childCategories.forEach(([cat, amount]) => {
                            checkPageBreak(5)
                            pdf.setFontSize(9)
                            pdf.setFont('helvetica', 'normal')
                            pdf.setTextColor(100, 100, 100)
                            pdf.text(`- ${cat}`, margin + 18, y)
                            pdf.text(`${currency} ${amount.toFixed(0)}`, margin + contentWidth - 30, y, { align: 'right' })
                            y += 4
                        })
                    }
                    y += 2
                })

                y += 2
                pdf.setDrawColor(240, 240, 240)
                pdf.line(margin, y, pageWidth - margin, y)
                y += 6
            })

            y += 2

            y += 5

            // ============ START NEW PAGE FOR DAY-WISE TRANSACTIONS ============
            pdf.addPage() // Force new page for Day-wise transactions
            y = margin

            // ============ DAY-WISE TRANSACTIONS ============
            checkPageBreak(30)
            pdf.setFontSize(14)
            pdf.setFont('helvetica', 'bold')
            pdf.setTextColor(30, 30, 30)
            pdf.text('DAY-WISE TRANSACTIONS', margin, y)
            y += 10

            let runningTotal = 0

            sortedDates.forEach((date, dayIndex) => {
                const dayExpenses = expensesByDate[date]
                const dayTotal = dayExpenses.reduce((sum: number, e: any) => sum + e.amount, 0)
                runningTotal += dayTotal

                // Day header
                checkPageBreak(25)
                pdf.setFillColor(240, 245, 255)
                pdf.rect(margin, y - 4, contentWidth, 8, 'F')
                pdf.setFontSize(11)
                pdf.setFont('helvetica', 'bold')
                pdf.setTextColor(40, 80, 150)
                pdf.text(`Day ${dayIndex + 1}: ${format(parseISO(date), 'EEEE, MMMM do, yyyy')}`, margin + 3, y)
                y += 10

                // Transactions header
                pdf.setFontSize(9)
                pdf.setFont('helvetica', 'bold')
                pdf.setTextColor(100, 100, 100)
                pdf.text('#', margin + 3, y)
                pdf.text('Time  Description', margin + 10, y)
                pdf.text('Category', margin + 60, y)
                pdf.text('Paid By', margin + 95, y)  // Shifted RIGHT to give Category more space
                pdf.text('Amount', margin + contentWidth - 10, y, { align: 'right' })
                y += 6

                // Transaction rows
                pdf.setFont('helvetica', 'normal')
                pdf.setTextColor(50, 50, 50)
                dayExpenses.forEach((expense: any, idx: number) => {
                    const payers = expense.expense_payers || []
                    let payerName = getParticipantName(expense.paid_by)
                    if (payers.length > 1) {
                        payerName = payers.map((p: any) => `${getParticipantName(p.participant_id)} (${currency} ${p.amount.toLocaleString()})`).join(', ')
                    }

                    // Calculate wrapped text dimensions
                    const maxPayerWidth = 60 // mm (Reduced from 70)
                    const maxTitleWidth = 45 // mm

                    const payerLines = pdf.splitTextToSize(payerName, maxPayerWidth)
                    const pdfTitleForCalc = expense.expense_time ? `${expense.expense_time}  ${expense.title}` : expense.title
                    const titleLines = pdf.splitTextToSize(pdfTitleForCalc, maxTitleWidth)

                    // Wrap comments if they exist
                    let commentLines: string[] = []
                    if (expense.comments) {
                        pdf.setFont('helvetica', 'italic')
                        pdf.setFontSize(7.5)
                        commentLines = pdf.splitTextToSize(`"${expense.comments}"`, maxTitleWidth)
                        pdf.setFont('helvetica', 'normal')
                        pdf.setFontSize(9)
                    }

                    const lineHeight = 4
                    const commentLineHeight = 3.5
                    const rows = Math.max(payerLines.length, titleLines.length)
                    
                    const mainRowHeight = rows * lineHeight
                    const commentHeight = commentLines.length > 0 ? (commentLines.length * commentLineHeight + 1) : 0
                    const attachmentHeight = expense.attachment_url ? 4.5 : 0
                    const leftHeight = mainRowHeight + commentHeight + attachmentHeight

                    // Splits
                    const splits = expense.expense_splits || []
                    const nonZeroSplits = splits.filter((s: any) => s.amount > 0.01)
                    const splitHeight = nonZeroSplits.length * 4
                    const rightHeight = mainRowHeight + splitHeight

                    const totalHeightNeeded = Math.max(leftHeight, rightHeight)

                    checkPageBreak(totalHeightNeeded)

                    // Increased truncation for Category since we have more space
                    const truncatedCategory = expense.category.length > 20 ? expense.category.substring(0, 18) + '...' : expense.category

                    pdf.setFontSize(9)
                    pdf.setTextColor(50, 50, 50)
                    pdf.text(`${idx + 1}`, margin + 3, y)
                    pdf.text(titleLines, margin + 10, y)
                    pdf.text(truncatedCategory, margin + 60, y)
                    pdf.text(payerLines, margin + 95, y) // Shifted RIGHT
                    pdf.text(`${currency} ${expense.amount.toLocaleString()}`, margin + contentWidth - 10, y, { align: 'right' })

                    // If comments exist, draw them below the title
                    let currentLeftY = y + mainRowHeight + 0.5
                    if (commentLines.length > 0) {
                        pdf.setFontSize(7.5)
                        pdf.setFont('helvetica', 'italic')
                        pdf.setTextColor(110, 110, 110)
                        pdf.text(commentLines, margin + 10, currentLeftY)
                        pdf.setFont('helvetica', 'normal')
                        pdf.setFontSize(9)
                        currentLeftY += (commentLines.length * commentLineHeight) + 1
                    }

                    // If attachment exists, draw link below comments/title
                    if (expense.attachment_url) {
                        pdf.setFontSize(8)
                        pdf.setFont('helvetica', 'bold')
                        pdf.setTextColor(40, 80, 180) // Link blue color
                        const text = `📎 Receipt: ${expense.attachment_name || 'View File'}`
                        
                        // We truncate attachment name if it is too long to fit
                        const maxNameWidth = 45
                        const truncatedText = pdf.splitTextToSize(text, maxNameWidth)[0]
                        
                        pdf.text(truncatedText, margin + 10, currentLeftY)
                        
                        // Add interactive link in the PDF
                        const textWidth = pdf.getTextWidth(truncatedText)
                        pdf.link(margin + 10, currentLeftY - 2.5, textWidth, 3, { url: expense.attachment_url })
                        
                        pdf.setFont('helvetica', 'normal')
                        pdf.setFontSize(9)
                    }

                    // Render Splits starting immediately below main row
                    if (nonZeroSplits.length > 0) {
                        pdf.setFontSize(8)
                        pdf.setFont('helvetica', 'normal')
                        pdf.setTextColor(130, 130, 130)
                        let splitY = y + mainRowHeight
                        nonZeroSplits.forEach((s: any) => {
                            const name = getParticipantName(s.participant_id)
                            const amountStr = `${currency} ${s.amount.toLocaleString()}`
                            const amountWidth = pdf.getTextWidth(amountStr)
                            // Name sits just left of the amount with a small gap
                            const nameX = margin + contentWidth - 10 - amountWidth - 3
                            pdf.text(name, nameX, splitY, { align: 'right' })
                            pdf.text(amountStr, margin + contentWidth - 10, splitY, { align: 'right' })
                            splitY += 4
                        })
                        pdf.setFontSize(9)
                        pdf.setFont('helvetica', 'normal')
                        pdf.setTextColor(50, 50, 50)
                    }

                    y += totalHeightNeeded
                    y += 3  // gap before next transaction
                })

                // Day totals
                y += 3
                pdf.setFontSize(10)
                pdf.setFont('helvetica', 'bold')
                pdf.setTextColor(60, 60, 60)
                pdf.text(`Day Total: ${currency} ${dayTotal.toLocaleString()}`, margin + contentWidth - 10, y, { align: 'right' })
                y += 5
                pdf.setTextColor(40, 100, 40)
                pdf.text(`Running Balance: ${currency} ${runningTotal.toLocaleString()}`, margin + contentWidth - 10, y, { align: 'right' })
                y += 6

                // Net Balances after this day
                const { settlements: daySettlements } = getBalancesUpToDate(dayIndex)
                if (daySettlements.length > 0) {
                    pdf.setFontSize(9)
                    pdf.setFont('helvetica', 'bold')
                    pdf.setTextColor(150, 100, 0)
                    pdf.text(`Net Balances after Day ${dayIndex + 1}:`, margin + 3, y)
                    y += 5

                    pdf.setFont('helvetica', 'normal')
                    daySettlements.forEach((s) => {
                        checkPageBreak(6)
                        pdf.setTextColor(120, 80, 0)
                        pdf.text(`  ${s.from} owes ${s.to}`, margin + 5, y)
                        pdf.setFont('helvetica', 'bold')
                        pdf.setTextColor(150, 100, 0)
                        pdf.text(`${currency} ${s.amount.toFixed(0)}`, margin + contentWidth - 10, y, { align: 'right' })
                        pdf.setFont('helvetica', 'normal')
                        y += 5
                    })
                    y += 3
                } else {
                    y += 5
                }
            })

            if (sortedDates.length === 0) {
                pdf.setFontSize(10)
                pdf.setFont('helvetica', 'italic')
                pdf.setTextColor(150, 150, 150)
                pdf.text('No expenses recorded yet.', pageWidth / 2, y, { align: 'center' })
                y += 10
            }

            drawLine()
            y += 5

            // ============ SETTLEMENT PLAN ============
            checkPageBreak(30)
            pdf.setFontSize(14)
            pdf.setFont('helvetica', 'bold')
            pdf.setTextColor(30, 30, 30)
            pdf.text('FINAL SETTLEMENT PLAN', margin, y)
            y += 10

            if (settlements.length === 0) {
                pdf.setFontSize(11)
                pdf.setFont('helvetica', 'bold')
                pdf.setTextColor(40, 140, 80)
                pdf.text('All Settled!', margin, y)
                y += 6
                pdf.setFont('helvetica', 'normal')
                pdf.setTextColor(100, 100, 100)
                pdf.text('No pending debts between members.', margin, y)
                y += 10
            } else {
                pdf.setFontSize(10)
                pdf.setFont('helvetica', 'normal')
                pdf.setTextColor(50, 50, 50)
                settlements.forEach((s, idx) => {
                    checkPageBreak(8)
                    pdf.text(`${idx + 1}. ${s.from} pays ${s.to}`, margin + 5, y)
                    pdf.setFont('helvetica', 'bold')
                    pdf.setTextColor(40, 80, 180)
                    pdf.text(`${currency} ${s.amount.toFixed(2)}`, margin + contentWidth - 10, y, { align: 'right' })
                    pdf.setFont('helvetica', 'normal')
                    pdf.setTextColor(50, 50, 50)
                    y += 7
                })
            }

            y += 5
            drawLine()
            y += 5

            // ============ FOOTER ============
            pdf.setFontSize(9)
            pdf.setFont('helvetica', 'normal')
            pdf.setTextColor(150, 150, 150)
            pdf.text(`Generated by TripPlanner | ${format(new Date(), 'MMM d, yyyy HH:mm')}`, pageWidth / 2, y, { align: 'center' })
            y += 5
            pdf.text('A proprietary framework designed and developed by Omnish Singhal', pageWidth / 2, y, { align: 'center' })

            // Save PDF
            pdf.save(`${trip.title.replace(/\s+/g, '_')}_Report.pdf`)
            toast.success('PDF Downloaded!', { id: 'pdf-toast' })

        } catch (error) {
            console.error('PDF Error:', error)
            toast.error(`Failed to generate PDF: ${error instanceof Error ? error.message : String(error)}`, { id: 'pdf-toast' })
        }
    }

    return (
        <div className="w-full space-y-4 pb-12 animate-fade-in relative">

            {/* Download Button */}
            <div className="flex justify-end mb-1 print:hidden">
                <button
                    onClick={handleDownloadPDF}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-bold shadow-lg transition-transform active:scale-95"
                >
                    <Download className="w-5 h-5" />
                    Download PDF Report
                </button>
            </div>

            {/* 5-Column Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                {/* LEFT: Report Preview (3 columns) */}
                <div className="lg:col-span-3 glass-panel p-4 space-y-6">

                    {/* Header */}
                    <div className="text-center pb-6 border-b border-gray-200 dark:border-gray-700">
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">{trip.title}</h1>
                        <p className="text-gray-500 dark:text-gray-400">{startDate} - {endDate}</p>
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{currency} {totalCost.toLocaleString()}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Cost</p>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{participants.length}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Members</p>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{duration} Days</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Duration</p>
                        </div>
                    </div>

                    {/* Members Section */}
                    <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Members</h2>
                        <div className="space-y-2">
                            {parentMembers.map((parent, idx) => {
                                const parentName = parent.profiles?.full_name || parent.name || parent.profiles?.email || 'Unknown'
                                const amountPaid = amountPaidByParticipant[parent.id] || 0
                                const children = getChildren(parent.id)

                                return (
                                    <div key={parent.id} className="space-y-1">
                                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <span className="text-gray-500 dark:text-gray-400 text-sm w-5">{idx + 1}.</span>
                                                <span className="font-medium text-gray-800 dark:text-white">{parentName}</span>
                                                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                                                    Parent
                                                </span>
                                            </div>
                                            <span className="font-mono font-bold text-gray-700 dark:text-gray-300">
                                                {currency} {amountPaid.toLocaleString()}
                                            </span>
                                        </div>
                                        {children.map(child => {
                                            const childName = child.profiles?.full_name || child.name || child.profiles?.email || 'Unknown'
                                            const childAmountPaid = amountPaidByParticipant[child.id] || 0
                                            return (
                                                <div key={child.id} className="flex items-center justify-between p-2 pl-10 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-gray-400">└──</span>
                                                        <span className="text-gray-600 dark:text-gray-400">{childName}</span>
                                                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                                                            Child
                                                        </span>
                                                    </div>
                                                    <span className="font-mono text-gray-500 dark:text-gray-400">
                                                        {currency} {childAmountPaid.toLocaleString()}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Day-wise Breakdown */}
                    <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Day-wise Breakdown</h2>
                        {sortedDates.length === 0 ? (
                            <p className="text-gray-400 dark:text-gray-500 italic text-center py-6">No expenses recorded yet.</p>
                        ) : (
                            <div className="space-y-4">
                                {(() => {
                                    let runningTotal = 0
                                    return sortedDates.map((date, dayIndex) => {
                                        const dayExpenses = expensesByDate[date]
                                        const dayTotal = dayExpenses.reduce((sum: number, e: any) => sum + e.amount, 0)
                                        runningTotal += dayTotal

                                        return (
                                            <div key={date} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                                                <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 flex justify-between items-center">
                                                    <span className="font-bold text-blue-700 dark:text-blue-400">
                                                        Day {dayIndex + 1}: {format(parseISO(date), 'EEE, MMM d')}
                                                    </span>
                                                    <span className="text-sm text-blue-600 dark:text-blue-300">
                                                        {dayExpenses.length} transaction{dayExpenses.length !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                                <div className="p-3 space-y-2">
                                                    {dayExpenses.map((expense: any, idx: number) => {
                                                        const isExpanded = expandedExpenses.has(expense.id)
                                                        const splits = (expense.expense_splits || []).filter((s: any) => s.amount > 0.01)
                                                        return (
                                                            <div key={expense.id} className="py-0.5">
                                                                <div
                                                                    className="flex items-center justify-between text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg px-1 py-1 -mx-1 transition-colors"
                                                                    onClick={() => splits.length > 0 && toggleExpense(expense.id)}
                                                                >
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <span className="text-gray-400 shrink-0 w-4">{idx + 1}.</span>
                                                                        <span className="text-gray-700 dark:text-gray-300 font-medium truncate">{expense.title}</span>
                                                                        <span className="text-gray-400 text-xs shrink-0">({expense.category})</span>
                                                                        {expense.expense_time && (
                                                                            <span className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 rounded shrink-0">{expense.expense_time}</span>
                                                                        )}
                                                                        {expense.attachment_url && (
                                                                            <a
                                                                                href={expense.attachment_url}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                className="p-0.5 rounded text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 transition shrink-0"
                                                                                title={`Open attachment: ${expense.attachment_name || 'Receipt'}`}
                                                                            >
                                                                                <Paperclip className="w-3.5 h-3.5" />
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                                                        <span className="font-mono font-medium text-gray-800 dark:text-gray-200">
                                                                            {currency} {expense.amount.toLocaleString()}
                                                                        </span>
                                                                        {splits.length > 0 && (
                                                                            <span className="text-gray-400">
                                                                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {/* Payer sub-line */}
                                                                <div className="ml-6 -mt-0.5 mb-1">
                                                                    {expense.expense_payers && expense.expense_payers.length > 1 ? (
                                                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                                                            {expense.expense_payers.map((p: any) => (
                                                                                <span key={p.participant_id} className="text-xs text-gray-500">
                                                                                    <span className="font-medium">{getParticipantName(p.participant_id)}</span>
                                                                                    <span className="ml-1 text-gray-400">({currency} {p.amount.toLocaleString()})</span>
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-xs text-gray-400">{getParticipantName(expense.paid_by)}</span>
                                                                    )}
                                                                </div>
                                                                {isExpanded && splits.length > 0 && (
                                                                    <div className="mt-1 mb-1 ml-6 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-2 border-gray-200 dark:border-gray-600">
                                                                        <span className="text-[10px] text-gray-400 mr-2">↳</span>
                                                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                            {splits.map((s: any, i: number) => (
                                                                                <span key={s.participant_id}>
                                                                                    {i > 0 && <span className="mx-2 text-gray-300">·</span>}
                                                                                    <span className="font-medium text-gray-600 dark:text-gray-300">{getParticipantName(s.participant_id)}</span>
                                                                                    <span className="ml-1 font-mono">{currency} {s.amount.toLocaleString()}</span>
                                                                                </span>
                                                                            ))}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                                <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-2 flex justify-between text-sm border-t border-gray-200 dark:border-gray-700">
                                                    <span className="font-medium text-gray-600 dark:text-gray-400">
                                                        Day Total: <span className="font-bold text-gray-800 dark:text-white">{currency} {dayTotal.toLocaleString()}</span>
                                                    </span>
                                                    <span className="font-medium text-green-600 dark:text-green-400">
                                                        Running: {currency} {runningTotal.toLocaleString()}
                                                    </span>
                                                </div>
                                                {/* Net Balances after this day */}
                                                {(() => {
                                                    const { settlements: daySettlements } = getBalancesUpToDate(dayIndex)
                                                    if (daySettlements.length === 0) return null
                                                    return (
                                                        <div className="bg-amber-50 dark:bg-amber-900/20 px-4 py-2 border-t border-amber-200 dark:border-amber-700">
                                                            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1.5">Net Balances after Day {dayIndex + 1}:</p>
                                                            <div className="space-y-1">
                                                                {daySettlements.map((s, idx) => (
                                                                    <div key={idx} className="flex items-center justify-between text-xs">
                                                                        <span className="text-amber-800 dark:text-amber-300">
                                                                            {s.from} → {s.to}
                                                                        </span>
                                                                        <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                                                                            {currency} {s.amount.toFixed(0)}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )
                                                })()}
                                            </div>
                                        )
                                    })
                                })()}
                            </div>
                        )}
                    </div>

                    {/* Settlement Plan */}
                    <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Settlement Plan</h2>
                        {settlements.length === 0 ? (
                            <div className="text-center py-6 bg-green-50 dark:bg-green-900/20 rounded-xl">
                                <p className="text-green-600 dark:text-green-400 font-bold">✓ All Settled!</p>
                                <p className="text-green-500 dark:text-green-500 text-sm">No pending debts between members.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {settlements.map((s, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-500 w-5">{idx + 1}.</span>
                                            <span className="font-medium text-gray-800 dark:text-gray-200">{s.from}</span>
                                            <span className="text-gray-400 text-sm">pays</span>
                                            <span className="font-medium text-gray-800 dark:text-gray-200">{s.to}</span>
                                        </div>
                                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                            {currency} {s.amount.toFixed(2)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer Info */}
                    <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            The PDF report includes:
                        </p>
                        <ul className="text-sm text-gray-600 dark:text-gray-300 mt-2 space-y-1">
                            <li>✓ Complete member breakdown with roles</li>
                            <li>✓ Day-wise transaction report ({sortedDates.length} days)</li>
                            <li>✓ Running balance after each day</li>
                            <li>✓ Final settlement plan ({settlements.length} pending)</li>
                        </ul>
                    </div>
                </div>

                {/* RIGHT: Category Split (2 columns) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="glass-panel p-6">
                        <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4 text-lg">Category Split</h3>
                        <div className="space-y-4">
                            {categoryData.length === 0 ? (
                                <p className="text-gray-400 text-sm text-center py-8">No expenses yet</p>
                            ) : (
                                categoryData.map((cat) => {
                                    const percentage = totalCost > 0 ? (cat.value / totalCost) * 100 : 0

                                    // Helper for colors/icons
                                    const { icon, colorClass, barColor } = getCategoryStyles(cat.name)

                                    return (
                                        <div key={cat.name} className="group">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${colorClass} dark:bg-opacity-20`}>
                                                        {icon}
                                                    </div>
                                                    <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">{cat.name}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="block font-bold text-gray-800 dark:text-white text-sm">{currency} {cat.value.toLocaleString()}</span>
                                                    <span className="text-xs text-gray-400">{percentage.toFixed(1)}%</span>
                                                </div>
                                            </div>
                                            {/* Progress Bar */}
                                            <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${barColor} rounded-full transition-all duration-500 ease-out`}
                                                    style={{ width: `${percentage}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        {/* Category Summary */}
                        {categoryData.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-500 dark:text-gray-400">Total Categories</span>
                                    <span className="font-bold text-gray-800 dark:text-white">{categoryData.length}</span>
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-sm text-gray-500 dark:text-gray-400">Highest Spend</span>
                                    <span className="font-bold text-gray-800 dark:text-white">{categoryData[0]?.name || '-'}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Final Cost Per Member (After Settlements) */}
                    <div className="glass-panel p-6">
                        <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4 text-lg">Final Cost Per Member</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            Each member's share of trip expenses with category-wise breakdown
                        </p>
                        <div className="space-y-4">
                            {parentMembers.map(parent => {
                                const children = getChildren(parent.id)
                                const parentName = parent.profiles?.full_name || parent.name || parent.profiles?.email || 'Unknown'

                                // Show each member's share of trip expenses
                                const memberShare = shareOfExpenses[parent.id] || 0
                                const parentBalance = balances.find(b => b.participantId === parent.id)?.amount || 0
                                const isSettled = Math.abs(parentBalance) < 0.01

                                // Calculate category-wise SHARE for this parent (based on splits)
                                const parentCategorySpend: Record<string, number> = {}
                                validExpenses.forEach(expense => {
                                    const splits = expense.expense_splits || []
                                    const parentSplit = splits.find((s: any) => s.participant_id === parent.id)
                                    if (parentSplit) {
                                        parentCategorySpend[expense.category] = (parentCategorySpend[expense.category] || 0) + parentSplit.amount
                                    }
                                })
                                const parentCategories = Object.entries(parentCategorySpend).sort((a, b) => b[1] - a[1])

                                if (memberShare === 0 && children.every(child => (shareOfExpenses[child.id] || 0) === 0)) {
                                    return null // Skip if no share at all
                                }

                                return (
                                    <div key={parent.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                        {/* Parent Header with Total */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${parent.role === 'owner' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                                    {(parentName || 'G')[0]}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-gray-800 dark:text-white">
                                                        {parentName}
                                                    </span>
                                                    {isSettled && (
                                                        <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full font-medium">
                                                            Settled
                                                        </span>
                                                    )}
                                                </div>
                                                {children.length > 0 && (
                                                    <span className="text-[10px] text-purple-500">+{children.length}</span>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <div className="font-mono text-base font-bold text-gray-800 dark:text-white">
                                                    {currency} {memberShare.toFixed(0)}
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    {totalCost > 0 ? ((memberShare / totalCost) * 100).toFixed(1) : 0}% of total
                                                </div>
                                            </div>
                                        </div>

                                        {/* Parent's Category Breakdown */}
                                        {parentCategories.length > 0 && (
                                            <div className="space-y-2 pl-10 mb-3">
                                                {parentCategories.map(([category, amount]) => {
                                                    const { icon } = getCategoryStyles(category)

                                                    return (
                                                        <div key={category} className="flex items-center justify-between py-1.5 px-2 rounded bg-gray-50 dark:bg-gray-800/50">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm">{icon}</span>
                                                                <span className="text-xs text-gray-600 dark:text-gray-400">{category}</span>
                                                            </div>
                                                            <span className="text-xs font-mono font-medium text-gray-800 dark:text-white">
                                                                {currency} {amount.toFixed(0)}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}

                                        {/* Children Members */}
                                        {children.map(child => {
                                            const childName = child.profiles?.full_name || child.name || child.profiles?.email || 'Unknown'
                                            const childShare = shareOfExpenses[child.id] || 0
                                            const childBalance = balances.find(b => b.participantId === child.id)?.amount || 0
                                            const childIsSettled = Math.abs(childBalance) < 0.01

                                            // Calculate child's category spending
                                            const childCategorySpend: Record<string, number> = {}
                                            validExpenses.forEach(expense => {
                                                const splits = expense.expense_splits || []
                                                const childSplit = splits.find((s: any) => s.participant_id === child.id)
                                                if (childSplit) {
                                                    childCategorySpend[expense.category] = (childCategorySpend[expense.category] || 0) + childSplit.amount
                                                }
                                            })
                                            const childCategories = Object.entries(childCategorySpend).sort((a, b) => b[1] - a[1])

                                            if (childShare === 0) return null

                                            return (
                                                <div key={child.id} className="ml-6 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                                    {/* Child Header with Total */}
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-purple-100 text-purple-600 dark:bg-purple-900/30">
                                                                {(childName || 'C')[0]}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                                                    {childName}
                                                                </span>
                                                                {childIsSettled && (
                                                                    <span className="text-[9px] px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full font-medium">
                                                                        Settled
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="font-mono text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                            {currency} {childShare.toFixed(0)}
                                                        </div>
                                                    </div>

                                                    {/* Child's Category Breakdown */}
                                                    {childCategories.length > 0 && (
                                                        <div className="space-y-1.5 pl-8">
                                                            {childCategories.map(([category, amount]) => {
                                                                const { icon } = getCategoryStyles(category)

                                                                return (
                                                                    <div key={category} className="flex items-center justify-between py-1 px-2 rounded bg-gray-50 dark:bg-gray-800/30">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-xs">{icon}</span>
                                                                            <span className="text-[11px] text-gray-600 dark:text-gray-400">{category}</span>
                                                                        </div>
                                                                        <span className="text-[11px] font-mono font-medium text-gray-700 dark:text-gray-300">
                                                                            {currency} {amount.toFixed(0)}
                                                                        </span>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Summary */}
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Trip Cost</span>
                                <span className="font-mono font-bold text-gray-800 dark:text-white">{currency} {totalCost.toFixed(0)}</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}



