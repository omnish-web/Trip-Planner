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
        .select('*')
    
    console.log("All Invitations:", data)
    if (error) console.error("Error:", error)
}

test()
