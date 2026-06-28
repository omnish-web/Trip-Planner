import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://anvpylnwjzvycinjvdao.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFudnB5bG53anp2eWNpbmp2ZGFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MzUxMDUsImV4cCI6MjA4NjAxMTEwNX0.-p5CutQyX2DeMzjM5W5Iaje0dRvfAT3d2vXCjzMUV9Y'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  console.log("=== Debugging Constraints ===")
  const { data, error } = await supabase.rpc('debug_expense_constraints')

  if (error) {
      console.error("RPC Error:", error)
  } else {
      console.log("Constraints on expenses:")
      console.table(data)
  }
}

test()
