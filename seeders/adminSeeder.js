const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import your actual User model
const User = require('../models/User');

// Admin user data with plain text passwords (will be hashed)
const adminUsers = [
  {
    email: 'admin@fty.com',
    password: 'admin123', // Will be hashed by pre-save hook
    firstName: 'Super',
    lastName: 'Admin',
    role: 'admin',
    isActive: true
  },
  {
    email: 'moderator@fty.com',
    password: 'moderator123',
    firstName: 'Content',
    lastName: 'Moderator',
    role: 'moderator',
    isActive: true
  },
  {
    email: 'viewer@fty.com',
    password: 'viewer123',
    firstName: 'Data',
    lastName: 'Viewer',
    role: 'viewer',
    isActive: true
  }
];

// Seeder function
const seedAdminUsers = async () => {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/phone_verification', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB successfully!');

    // Check if admin users already exist
    console.log('Checking for existing admin users...');
    const existingEmails = adminUsers.map(user => user.email);
    const existingUsers = await User.find({ email: { $in: existingEmails } });

    if (existingUsers.length > 0) {
      console.log('⚠️  Existing admin users found:');
      existingUsers.forEach(user => {
        console.log(`   - ${user.email} (${user.role})`);
      });
      
      // Ask for confirmation to proceed
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise((resolve) => {
        readline.question('Do you want to delete and recreate them? (yes/no): ', resolve);
      });
      readline.close();

      if (answer.toLowerCase() !== 'yes') {
        console.log('❌ Seeder cancelled.');
        process.exit(0);
      }

      // Delete existing users
      console.log('🗑️  Deleting existing admin users...');
      await User.deleteMany({ email: { $in: existingEmails } });
      console.log('✅ Existing users deleted.');
    }

    // Create new users using the actual User model
    console.log('👤 Creating new admin users...');
    
    const createdUsers = [];
    for (const userData of adminUsers) {
      try {
        const user = new User(userData);
        await user.save(); // This will trigger the pre-save hook to hash the password
        createdUsers.push(user);
        console.log(`   ✅ Created: ${user.email}`);
      } catch (error) {
        console.error(`   ❌ Failed to create ${userData.email}:`, error.message);
      }
    }

    // Verify that passwords were hashed
    console.log('\n🔍 Verifying password hashing...');
    for (const user of createdUsers) {
      const dbUser = await User.findById(user._id);
      const isPasswordHashed = dbUser.password !== adminUsers.find(u => u.email === dbUser.email).password;
      
      console.log(`   ${dbUser.email}: ${isPasswordHashed ? '✅ Password hashed' : '❌ Password NOT hashed'}`);
      
      // Test password verification
      const plainPassword = adminUsers.find(u => u.email === dbUser.email).password;
      const isPasswordValid = await bcrypt.compare(plainPassword, dbUser.password);
      console.log(`     Password verification: ${isPasswordValid ? '✅ Success' : '❌ Failed'}`);
    }

    console.log('\n🎉 Seeding completed successfully!');
    console.log('\n📋 Login credentials:');
    console.log('   Admin:     admin@fty.com / admin123');
    console.log('   Moderator: moderator@fty.com / moderator123');
    console.log('   Viewer:    viewer@fty.com / viewer123');

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    if (error.code === 11000) {
      console.error('   Duplicate email found. Please delete existing users first.');
    }
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed.');
    process.exit(0);
  }
};

// Manual password hashing function (fallback)
const manuallyHashPasswords = async (users) => {
  const hashedUsers = [];
  
  for (const user of users) {
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(user.password, salt);
    
    hashedUsers.push({
      ...user,
      password: hashedPassword
    });
  }
  
  return hashedUsers;
};

// Alternative seeder with manual password hashing
const seedAdminUsersWithManualHashing = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Manually hash passwords first
    console.log('🔐 Manually hashing passwords...');
    const hashedUsers = await manuallyHashPasswords(adminUsers);

    // Delete existing users
    const existingEmails = adminUsers.map(user => user.email);
    await User.deleteMany({ email: { $in: existingEmails } });

    // Insert users with pre-hashed passwords
    console.log('👤 Creating users with pre-hashed passwords...');
    const result = await User.insertMany(hashedUsers);
    
    console.log('✅ Users created successfully with hashed passwords!');
    console.log('\n📋 Login credentials:');
    result.forEach(user => {
      const originalPassword = adminUsers.find(u => u.email === user.email).password;
      console.log(`   ${user.email} / ${originalPassword}`);
    });

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
  } finally {
    await mongoose.connection.close();
  }
};

// Run the seeder if this file is executed directly
if (require.main === module) {
  console.log('🚀 Starting Admin User Seeder...\n');
  
  // Use manual hashing if first argument is --manual
  if (process.argv.includes('--manual')) {
    seedAdminUsersWithManualHashing();
  } else {
    seedAdminUsers();
  }
}

module.exports = { 
  seedAdminUsers, 
  seedAdminUsersWithManualHashing,
  adminUsers 
};