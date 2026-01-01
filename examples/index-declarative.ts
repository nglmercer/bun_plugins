/**
 * Declarative Examples Index
 * 
 * This file serves as the main entry point for all declarative examples,
 * providing a clean overview and easy access to different use cases.
 */

import { runDemo } from "./shared/plugin-builder";

// Import all declarative examples
import { demonstrateDeclarativeActionRegistry } from "./action-registry-declarative";
import { demonstrateDeclarativeStorage } from "./storage-declarative";
import { demonstrateDeclarativeLogging } from "./logger-declarative";
import { demonstrateDeclarativeServer } from "./server-declarative";

// Example catalog with descriptions
const exampleCatalog = [
  {
    id: 'action-registry',
    name: 'Action Registry',
    description: 'Declarative plugin system with action registration and execution',
    file: 'action-registry-declarative.ts',
    demo: demonstrateDeclarativeActionRegistry,
    features: [
      'Declarative action definitions',
      'Plugin-based architecture',
      'Dynamic action registration',
      'Error handling',
      'Plugin discovery'
    ]
  },
  {
    id: 'storage',
    name: 'Storage System',
    description: 'Clean storage operations with declarative configuration',
    file: 'storage-declarative.ts',
    demo: demonstrateDeclarativeStorage,
    features: [
      'Declarative storage operations',
      'CRUD operations',
      'Configuration management',
      'Data validation',
      'Plugin isolation support'
    ]
  },
  {
    id: 'logging',
    name: 'Logging System',
    description: 'Flexible logging with multiple adapters and configurations',
    file: 'logger-declarative.ts',
    demo: demonstrateDeclarativeLogging,
    features: [
      'Multiple logger adapters',
      'Hierarchical logging',
      'Structured logging',
      'Performance monitoring',
      'Plugin-specific loggers'
    ]
  },
  {
    id: 'server',
    name: 'HTTP Server',
    description: 'Plugin-powered HTTP server with declarative routing',
    file: 'server-declarative.ts',
    demo: demonstrateDeclarativeServer,
    features: [
      'Declarative route definitions',
      'Plugin-based handlers',
      'Error handling',
      'JSON API',
      'Action execution'
    ]
  }
];

// Main menu system
const showMainMenu = () => {
  console.log("\n🎯 Declarative Plugin System Examples");
  console.log("=====================================\n");
  
  exampleCatalog.forEach((example, index) => {
    console.log(`${index + 1}. ${example.name}`);
    console.log(`   ${example.description}`);
    console.log(`   File: ${example.file}`);
    console.log(`   Features: ${example.features.join(', ')}`);
    console.log();
  });
  
  console.log("0. Run all examples");
  console.log("q. Quit");
  console.log();
};

// Run specific example
const runExample = async (index: number) => {
  const example = exampleCatalog[index];
  if (!example) {
    console.log("❌ Invalid example number");
    return;
  }
  
  // Wrap server demo to return void
  const wrappedDemo = async () => {
    if (example.id === 'server') {
      await example.demo();
      console.log("\n🌐 Server is running. Press Ctrl+C to stop.");
    } else {
      await example.demo();
    }
  };
  
  await runDemo(`${example.name} Example`, wrappedDemo);
};

// Run all examples (excluding server which blocks)
const runAllExamples = async () => {
  console.log("\n🚀 Running all declarative examples...\n");
  
  for (const example of exampleCatalog) {
    if (example.id === 'server') {
      console.log(`⏭️  Skipping ${example.name} (server blocks execution)`);
      continue;
    }
    // Wrap demo to ensure it returns void
    const wrappedDemo = async () => {
      await example.demo();
    };
    await runDemo(example.name, wrappedDemo);
  }
  
  console.log("\n✅ All examples completed!");
};

// Interactive menu
const interactiveMenu = async () => {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const askQuestion = (question: string): Promise<string> => {
    return new Promise(resolve => {
      rl.question(question, resolve);
    });
  };
  
  while (true) {
    showMainMenu();
    const answer = await askQuestion("Select an example (number) or 'q' to quit: ");
    
    if (answer.toLowerCase() === 'q') {
      break;
    }
    
    if (answer === '0') {
      await runAllExamples();
      continue;
    }
    
    const index = parseInt(answer) - 1;
    if (!isNaN(index)) {
      await runExample(index);
    } else {
      console.log("❌ Invalid input");
    }
    
    const continueAnswer = await askQuestion("\nPress Enter to continue or 'q' to quit: ");
    if (continueAnswer.toLowerCase() === 'q') {
      break;
    }
  }
  
  rl.close();
};

// Quick run function
const quickRun = async (exampleId: string) => {
  const example = exampleCatalog.find(e => e.id === exampleId);
  if (!example) {
    console.log(`❌ Example '${exampleId}' not found`);
    console.log("Available examples:", exampleCatalog.map(e => e.id).join(', '));
    return;
  }
  
  // Wrap server demo to return void
  const wrappedDemo = async () => {
    if (example.id === 'server') {
      await example.demo();
      console.log("\n🌐 Server is running. Press Ctrl+C to stop.");
    } else {
      await example.demo();
    }
  };
  
  await runDemo(example.name, wrappedDemo);
};

// Export everything
export {
  exampleCatalog,
  showMainMenu,
  runExample,
  runAllExamples,
  interactiveMenu,
  quickRun,
  // Individual demos
  demonstrateDeclarativeActionRegistry,
  demonstrateDeclarativeStorage,
  demonstrateDeclarativeLogging,
  demonstrateDeclarativeServer
};

// Run if called directly
if (import.meta.main) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Interactive mode
    interactiveMenu().catch(console.error);
  } else if (args[0] === '--all') {
    // Run all examples
    runAllExamples().catch(console.error);
  } else if (args[0] === '--example' && args[1]) {
    // Run specific example
    quickRun(args[1]).catch(console.error);
  } else {
    console.log("\n🎯 Declarative Plugin System Examples");
    console.log("Usage:");
    console.log("  bun run examples/index-declarative.ts          # Interactive menu");
    console.log("  bun run examples/index-declarative.ts --all    # Run all examples");
    console.log("  bun run examples/index-declarative.ts --example <id>  # Run specific example");
    console.log("\nAvailable examples:", exampleCatalog.map(e => e.id).join(', '));
  }
}