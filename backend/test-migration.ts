import { prisma } from './src/config/database';

/**
 * Test script to verify database migrations and Prisma Client
 */
async function testMigration() {
  try {
    console.log('Testing database connection and schema...\n');

    // Test 1: Connect to database
    await prisma.$connect();
    console.log('✓ Database connection successful');

    // Test 2: Query User table (should be empty initially)
    const userCount = await prisma.user.count();
    console.log(`✓ User table accessible (current count: ${userCount})`);

    // Test 3: Create a test user
    const testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        hashedPassword: 'hashed_password_here',
      },
    });
    console.log(`✓ User creation successful (ID: ${testUser.id})`);

    // Test 4: Read the user back
    const foundUser = await prisma.user.findUnique({
      where: { email: 'test@example.com' },
    });
    console.log(`✓ User retrieval successful (Email: ${foundUser?.email})`);

    // Test 5: Update the user
    const updatedUser = await prisma.user.update({
      where: { id: testUser.id },
      data: { email: 'updated@example.com' },
    });
    console.log(`✓ User update successful (New email: ${updatedUser.email})`);

    // Test 6: Delete the test user
    await prisma.user.delete({
      where: { id: testUser.id },
    });
    console.log('✓ User deletion successful');

    // Test 7: Verify deletion
    const finalCount = await prisma.user.count();
    console.log(`✓ Final user count: ${finalCount}`);

    console.log('\n✅ All migration tests passed!');
  } catch (error) {
    console.error('\n❌ Migration test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testMigration();
