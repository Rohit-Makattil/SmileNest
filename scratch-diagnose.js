const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Helper to load env variables from .env.local manually
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('ERROR: .env.local file not found!');
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      // Remove surrounding quotes if any
      if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
        value = value.substring(1, value.length - 1);
      }
      env[key] = value.trim();
    }
  });
  return env;
}

async function runDiagnostics() {
  const env = loadEnv();
  
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl) {
    console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL is missing in .env.local');
    return;
  }
  
  console.log(`Checking connection to Supabase Project: ${supabaseUrl}`);
  
  if (!serviceRoleKey) {
    console.warn('WARNING: SUPABASE_SERVICE_ROLE_KEY is missing. Admin check will be limited.');
  }

  // Create admin client
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey || anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  try {
    // 1. Test database ping
    console.log('\n--- 1. Testing Database Connectivity ---');
    const { data: pingData, error: pingError } = await supabaseAdmin
      .from('captures')
      .select('count', { count: 'exact', head: true });
      
    if (pingError) {
      console.error('❌ Connection Failed! Database error:', pingError.message);
      console.error('Code:', pingError.code);
      return;
    }
    console.log('✅ Connection Successful! Captured rows count: ', pingData);

    // 2. Query admin_users whitelist table
    console.log('\n--- 2. Checking public.admin_users Table ---');
    const { data: adminUsers, error: adminUsersError } = await supabaseAdmin
      .from('admin_users')
      .select('*');

    if (adminUsersError) {
      console.error('❌ Failed to fetch admin_users table:', adminUsersError.message);
    } else {
      console.log(`✅ Table read successful. Found ${adminUsers.length} whitelisted admins:`);
      adminUsers.forEach(user => {
        console.log(`   - ID: ${user.id} | Email: ${user.email} (Whitelisted: ${user.created_at})`);
      });
      if (adminUsers.length === 0) {
        console.log('   ⚠️ WARNING: The admin_users table is empty. No emails are whitelisted!');
      }
    }

    // 3. Query auth users list (requires service role key)
    if (serviceRoleKey) {
      console.log('\n--- 3. Querying auth.users (Supabase Authentication Accounts) ---');
      const { data: { users }, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (authUsersError) {
        console.error('❌ Failed to fetch auth users list:', authUsersError.message);
      } else {
        console.log(`✅ Auth accounts found: ${users.length}`);
        users.forEach(u => {
          const isWhitelisted = adminUsers && adminUsers.some(au => au.id === u.id);
          console.log(`   - ID: ${u.id} | Email: ${u.email} | Verified: ${u.email_confirmed_at ? 'Yes' : 'No'} | Whitelisted: ${isWhitelisted ? '✅ YES' : '❌ NO'}`);
        });
      }
    }

  } catch (err) {
    console.error('An unexpected error occurred during diagnostics:', err);
  }
}

runDiagnostics();
