const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const newPassword = process.argv[2];

if (!newPassword) {
  console.log('Usage: node reset-password.js <new_password>');
  process.exit(1);
}

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
      if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
        value = value.substring(1, value.length - 1);
      }
      env[key] = value.trim();
    }
  });
  return env;
}

async function resetPassword() {
  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const adminId = 'fb5634f0-c99c-43e1-921a-5d9a10bbb660'; // ID for rohitmakattil94@gmail.com

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('ERROR: Supabase URL or Service Role Key missing in .env.local!');
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  console.log(`Resetting password for admin ID: ${adminId} (rohitmakattil94@gmail.com)...`);

  try {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      adminId,
      { password: newPassword }
    );

    if (error) {
      console.error('❌ Reset failed:', error.message);
    } else {
      console.log('✅ Password successfully updated! You can now log in using the new password.');
    }
  } catch (err) {
    console.error('An unexpected error occurred:', err);
  }
}

resetPassword();
