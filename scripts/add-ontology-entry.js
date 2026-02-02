#!/usr/bin/env node
/**
 * Add Ontology Entry
 * Quick script to add new entities to the ontology database
 * 
 * Usage:
 *   node add-ontology-entry.js "Entity Name" ENTITY_TYPE [confidence] [source]
 * 
 * Examples:
 *   node add-ontology-entry.js "DeepMind" STARTUP 1.0 MANUAL_SEED
 *   node add-ontology-entry.js "Techstars" INVESTOR 1.0 MANUAL_SEED
 *   node add-ontology-entry.js "Miami Tech Hub" GENERIC_TERM 1.0 MANUAL_SEED
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const VALID_TYPES = ['STARTUP', 'INVESTOR', 'FOUNDER', 'EXECUTIVE', 'PLACE', 'GENERIC_TERM', 'AMBIGUOUS'];
const VALID_SOURCES = ['MANUAL_SEED', 'CRUNCHBASE', 'ML_INFERENCE', 'USER_CORRECTION'];

async function addOntologyEntry(entityName, entityType, confidence = 1.0, source = 'MANUAL_SEED', metadata = {}) {
  // Validate inputs
  if (!entityName) {
    console.error('❌ Error: Entity name is required');
    console.log('\nUsage: node add-ontology-entry.js "Entity Name" ENTITY_TYPE [confidence] [source]');
    process.exit(1);
  }
  
  if (!VALID_TYPES.includes(entityType)) {
    console.error(`❌ Error: Invalid entity type "${entityType}"`);
    console.log(`Valid types: ${VALID_TYPES.join(', ')}`);
    process.exit(1);
  }
  
  if (!VALID_SOURCES.includes(source)) {
    console.error(`❌ Error: Invalid source "${source}"`);
    console.log(`Valid sources: ${VALID_SOURCES.join(', ')}`);
    process.exit(1);
  }
  
  if (confidence < 0 || confidence > 1) {
    console.error('❌ Error: Confidence must be between 0 and 1');
    process.exit(1);
  }
  
  // Check if entity already exists
  const { data: existing } = await supabase
    .from('entity_ontologies')
    .select('*')
    .ilike('entity_name', entityName)
    .single();
  
  if (existing) {
    console.log(`⚠️  Entity "${entityName}" already exists:`);
    console.log(`   Type: ${existing.entity_type}`);
    console.log(`   Confidence: ${existing.confidence}`);
    console.log(`   Source: ${existing.source}`);
    console.log('\nUpdate instead? (Not implemented yet)');
    return;
  }
  
  // Insert new entry
  const { data, error } = await supabase
    .from('entity_ontologies')
    .insert({
      entity_name: entityName,
      entity_type: entityType,
      confidence: parseFloat(confidence),
      source: source,
      metadata: metadata
    })
    .select()
    .single();
  
  if (error) {
    console.error('❌ Error inserting ontology entry:', error.message);
    process.exit(1);
  }
  
  console.log('✅ Ontology entry added successfully:\n');
  console.log(`   Entity: ${data.entity_name}`);
  console.log(`   Type: ${data.entity_type}`);
  console.log(`   Confidence: ${data.confidence}`);
  console.log(`   Source: ${data.source}`);
  console.log(`   ID: ${data.id}`);
  console.log('');
}

// Parse command line args
const args = process.argv.slice(2);
const [entityName, entityType, confidence, source] = args;

if (args.length < 2) {
  console.log('📖 Add Ontology Entry\n');
  console.log('Usage:');
  console.log('  node add-ontology-entry.js "Entity Name" ENTITY_TYPE [confidence] [source]\n');
  console.log('Entity Types:');
  VALID_TYPES.forEach(type => console.log(`  - ${type}`));
  console.log('\nSources:');
  VALID_SOURCES.forEach(src => console.log(`  - ${src}`));
  console.log('\nExamples:');
  console.log('  node add-ontology-entry.js "DeepMind" STARTUP 1.0 MANUAL_SEED');
  console.log('  node add-ontology-entry.js "Techstars" INVESTOR 1.0 MANUAL_SEED');
  console.log('  node add-ontology-entry.js "Miami Tech" GENERIC_TERM 1.0 MANUAL_SEED');
  process.exit(0);
}

addOntologyEntry(entityName, entityType, confidence, source);
