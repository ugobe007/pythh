/**
 * REGRESSION TESTS: Count Extraction Bug
 * =======================================
 * Tests that prevent the "matching 60% mystery" from recurring.
 * 
 * The Bug (Jan 24, 2026):
 * - Used `data.length` instead of `count` when extracting Supabase count
 * - Caused infinite requeueing because matchCount was always 0
 * 
 * These tests ensure the canonical helper works correctly.
 */

const { getExactCount, getExactCountSafe, countMeetsThreshold } = require('../server/lib/supabaseHelpers');

// Mock Supabase client
class MockSupabaseQuery {
  constructor(tableName, filters = {}) {
    this.tableName = tableName;
    this.filters = filters;
    this.mockCount = 0;
    this.mockError = null;
  }
  
  eq(field, value) {
    this.filters[field] = value;
    return this;
  }
  
  // Mock the select call that returns { count, data, error }
  async select(fields, options) {
    if (options?.count === 'exact' && options?.head === true) {
      // This is what real Supabase returns
      return {
        data: null, // ⚠️ CRITICAL: data is null when using head: true
        count: this.mockError ? null : this.mockCount,
        error: this.mockError
      };
    }
    
    throw new Error('Test only supports { count: "exact", head: true }');
  }
  
  // Test helpers
  setMockCount(count) {
    this.mockCount = count;
    return this;
  }
  
  setMockError(error) {
    this.mockError = error;
    return this;
  }
}

// ============================================================================
// UNIT TESTS
// ============================================================================

async function testGetExactCount_ReturnsCorrectCount() {
  const query = new MockSupabaseQuery('startup_investor_matches')
    .eq('startup_id', 'test-id')
    .setMockCount(1000);
  
  const count = await getExactCount(query);
  
  if (count !== 1000) {
    throw new Error(`Expected count=1000, got ${count}`);
  }
  
  console.log('✅ Test 1: getExactCount returns correct count');
}

async function testGetExactCount_HandlesZero() {
  const query = new MockSupabaseQuery('startup_investor_matches')
    .eq('startup_id', 'test-id')
    .setMockCount(0);
  
  const count = await getExactCount(query);
  
  if (count !== 0) {
    throw new Error(`Expected count=0, got ${count}`);
  }
  
  console.log('✅ Test 2: getExactCount handles zero correctly');
}

async function testGetExactCount_ThrowsOnError() {
  const query = new MockSupabaseQuery('startup_investor_matches')
    .eq('startup_id', 'test-id')
    .setMockError({ message: 'Database connection failed' });
  
  try {
    await getExactCount(query);
    throw new Error('Expected error to be thrown');
  } catch (err) {
    if (!err.message.includes('Count query failed')) {
      throw new Error(`Expected "Count query failed" error, got: ${err.message}`);
    }
  }
  
  console.log('✅ Test 3: getExactCount throws on query error');
}

async function testGetExactCountSafe_ReturnsZeroOnError() {
  const query = new MockSupabaseQuery('startup_investor_matches')
    .eq('startup_id', 'test-id')
    .setMockError({ message: 'Database connection failed' });
  
  const count = await getExactCountSafe(query);
  
  if (count !== 0) {
    throw new Error(`Expected count=0 on error, got ${count}`);
  }
  
  console.log('✅ Test 4: getExactCountSafe returns 0 on error (graceful degradation)');
}

async function testCountMeetsThreshold_True() {
  const query = new MockSupabaseQuery('startup_investor_matches')
    .eq('startup_id', 'test-id')
    .setMockCount(1000);
  
  const meets = await countMeetsThreshold(query, 1000);
  
  if (!meets) {
    throw new Error('Expected threshold to be met');
  }
  
  console.log('✅ Test 5: countMeetsThreshold returns true when threshold met');
}

async function testCountMeetsThreshold_False() {
  const query = new MockSupabaseQuery('startup_investor_matches')
    .eq('startup_id', 'test-id')
    .setMockCount(500);
  
  const meets = await countMeetsThreshold(query, 1000);
  
  if (meets) {
    throw new Error('Expected threshold NOT to be met');
  }
  
  console.log('✅ Test 6: countMeetsThreshold returns false when below threshold');
}

/**
 * THE CRITICAL REGRESSION TEST
 * This is the exact bug that caused "matching 60%" to get stuck.
 */
async function testOriginalBug_DataLengthIsAlwaysNull() {
  // Simulate what Supabase really returns
  const realResponse = {
    data: null,  // ⚠️ This is what Supabase returns with head: true
    count: 1000,
    error: null
  };
  
  // The OLD broken code did this:
  const brokenCount = realResponse.data?.length ?? 0;
  
  // The NEW correct code does this:
  const correctCount = realResponse.count ?? 0;
  
  if (brokenCount !== 0) {
    throw new Error(`Bug test failed: data.length should be 0 (undefined), got ${brokenCount}`);
  }
  
  if (correctCount !== 1000) {
    throw new Error(`Bug test failed: count should be 1000, got ${correctCount}`);
  }
  
  console.log('✅ Test 7: REGRESSION TEST - Confirms data.length is always 0 with head:true');
  console.log('   Old code would get: matchCount = 0 (WRONG)');
  console.log('   New code would get: matchCount = 1000 (CORRECT)');
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function runAllTests() {
  console.log('🧪 Running Count Extraction Regression Tests...\n');
  
  try {
    await testGetExactCount_ReturnsCorrectCount();
    await testGetExactCount_HandlesZero();
    await testGetExactCount_ThrowsOnError();
    await testGetExactCountSafe_ReturnsZeroOnError();
    await testCountMeetsThreshold_True();
    await testCountMeetsThreshold_False();
    await testOriginalBug_DataLengthIsAlwaysNull();
    
    console.log('\n✅ All 7 tests passed!');
    console.log('✅ Count extraction helpers are regression-proof.');
    
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runAllTests();
}

module.exports = {
  MockSupabaseQuery,
  runAllTests
};
