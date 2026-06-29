import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
    const { data, error } = await supabase
        .from('trip_invitations')
        .select(`
            id, trip_id, inviter_id, invitee_id, status, created_at,
            invitee:profiles!trip_invitations_invitee_id_fkey(full_name, username_id)
        `)
        .eq('status', 'pending')
    
    console.log("Error:", error)
    console.log("Data:", data)
}

test()
