/**
 * OSRM Integration Test Script
 * Demonstrates Phase 1 shipping cost calculation with OSRM routing
 */

import osrmService from './services/osrmService.js';
import * as estimateService from './services/shipping/estimateService.js';
import logger from './utils/logger.js';

async function testOSRMIntegration() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║   OSRM Integration Test - Phase 1 Estimates       ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  // Test Case 1: Mumbai to Delhi (long distance)
  console.log('📍 Test 1: Mumbai → Delhi (Long Distance)');
  console.log('─────────────────────────────────────────────────────');
  
  const mumbaiDelhi = await osrmService.getDrivingDistance(
    { lat: 19.0760, lon: 72.8777 }, // Mumbai
    { lat: 28.6139, lon: 77.2090 }  // Delhi
  );
  
  console.log(`Distance: ${mumbaiDelhi.distanceKm} km`);
  console.log(`Duration: ${mumbaiDelhi.durationMinutes} minutes`);
  console.log(`Method: ${mumbaiDelhi.method}`);
  console.log(`Success: ${mumbaiDelhi.success ? '✅' : '❌'}`);
  
  const estimateMD = await estimateService.getQuickEstimate({
    origin: { lat: 19.0760, lon: 72.8777, postalCode: '400001' },
    destination: { lat: 28.6139, lon: 77.2090, postalCode: '110001' },
    weightKg: 2.5,
    dimensions: { length: 40, width: 30, height: 20 },
    serviceType: 'standard'
  });
  
  console.log(`\nEstimate: ₹${estimateMD.estimatedCost}`);
  console.log(`Range: ${estimateMD.range}`);
  console.log(`Delivery: ${estimateMD.estimatedDaysRange} days`);
  console.log(`Billable Weight: ${estimateMD.billableWeight} kg`);
  
  // Test Case 2: Bangalore to Chennai (medium distance)
  console.log('\n\n📍 Test 2: Bangalore → Chennai (Medium Distance)');
  console.log('─────────────────────────────────────────────────────');
  
  const bangaloreChennai = await osrmService.getDrivingDistance(
    { lat: 12.9716, lon: 77.5946 }, // Bangalore
    { lat: 13.0827, lon: 80.2707 }  // Chennai
  );
  
  console.log(`Distance: ${bangaloreChennai.distanceKm} km`);
  console.log(`Duration: ${bangaloreChennai.durationMinutes} minutes`);
  console.log(`Method: ${bangaloreChennai.method}`);
  
  const estimateBC = await estimateService.getQuickEstimate({
    origin: { lat: 12.9716, lon: 77.5946, postalCode: '560001' },
    destination: { lat: 13.0827, lon: 80.2707, postalCode: '600001' },
    weightKg: 1.0,
    serviceType: 'express'
  });
  
  console.log(`\nEstimate: ₹${estimateBC.estimatedCost}`);
  console.log(`Range: ${estimateBC.range}`);
  console.log(`Delivery: ${estimateBC.estimatedDaysRange} days`);
  
  // Test Case 3: Local delivery (short distance)
  console.log('\n\n📍 Test 3: Mumbai Local (Short Distance)');
  console.log('─────────────────────────────────────────────────────');
  
  const mumbaiLocal = await osrmService.getDrivingDistance(
    { lat: 19.0760, lon: 72.8777 }, // South Mumbai
    { lat: 19.1136, lon: 72.8697 }  // Andheri
  );
  
  console.log(`Distance: ${mumbaiLocal.distanceKm} km`);
  console.log(`Duration: ${mumbaiLocal.durationMinutes} minutes`);
  
  const estimateLocal = await estimateService.getQuickEstimate({
    origin: { lat: 19.0760, lon: 72.8777, postalCode: '400001' },
    destination: { lat: 19.1136, lon: 72.8697, postalCode: '400053' },
    weightKg: 0.5,
    serviceType: 'express'
  });
  
  console.log(`\nEstimate: ₹${estimateLocal.estimatedCost}`);
  console.log(`Range: ${estimateLocal.range}`);
  console.log(`Delivery: ${estimateLocal.estimatedDaysRange} days`);
  
  // Test Case 4: Volumetric weight vs actual weight
  console.log('\n\n📍 Test 4: Volumetric Weight Calculation');
  console.log('─────────────────────────────────────────────────────');
  
  const estimateVolumetric = await estimateService.getQuickEstimate({
    origin: { lat: 19.0760, lon: 72.8777, postalCode: '400001' },
    destination: { lat: 28.6139, lon: 77.2090, postalCode: '110001' },
    weightKg: 1.0,  // Light item
    dimensions: { length: 50, width: 50, height: 50 }, // Large box
    serviceType: 'standard'
  });
  
  console.log(`Actual Weight: 1.0 kg`);
  console.log(`Volumetric Weight: ${estimateVolumetric.volumetricWeight} kg`);
  console.log(`Billable Weight: ${estimateVolumetric.billableWeight} kg (max of both)`);
  console.log(`Estimate: ₹${estimateVolumetric.estimatedCost}`);
  
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║              All Tests Completed! ✅               ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
}

// Run tests
testOSRMIntegration().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
