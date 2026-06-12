import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://drelgoarjnyzvtmuqtns.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyZWxnb2Fyam55enZ0bXVxdG5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTA1MTgsImV4cCI6MjA5NDc4NjUxOH0.4vDb052urOGoO_1Ytd50lZoN4WN99RVFU_zvtBhWxsg'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
