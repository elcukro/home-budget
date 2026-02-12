// Simple test to see if the file can be read
import { readFileSync } from 'fs';

try {
  const content = readFileSync('./src/components/savings/RetirementLimitsCard.tsx', 'utf8');
  console.log('✅ File can be read');
  console.log(`📊 Size: ${content.length} bytes`);
  console.log(`📝 Lines: ${content.split('\n').length}`);

  // Check for any weird characters
  const hasNullBytes = content.includes('\0');
  console.log(`🔍 Has null bytes: ${hasNullBytes ? '❌ YES' : '✅ NO'}`);

  // Check if it's valid UTF-8
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    decoder.decode(encoder.encode(content));
    console.log('✅ Valid UTF-8');
  } catch (e) {
    console.log('❌ Invalid UTF-8');
  }
} catch (error) {
  console.error('❌ Error reading file:', error.message);
  process.exit(1);
}
