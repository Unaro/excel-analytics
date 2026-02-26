// lib/utils/formula.ts
import { parse, MathNode } from 'mathjs';

interface MathSymbolNode extends MathNode {
  name: string;
}

/**
 * Извлекает список переменных из формулы
 * Пример: "a + b / 100" -> ["a", "b"]
 */
export function extractVariables(formula: string): string[] {
  if (!formula || !formula.trim()) return [];

  try {
    const node = parse(formula);
    const foundDeps = new Set<string>();
    
    node.traverse(function (node: MathNode) {
      if (node.type === 'SymbolNode') {
         const symbolNode = node as unknown as MathSymbolNode;
         
         if (typeof symbolNode.name === 'string') {
           const builtIns = [
             'sqrt', 'pow', 'max', 'min', 'abs', 'round', 
             'floor', 'ceil', 'log', 'exp', 'sin', 'cos', 'tan',
             'pi', 'e'
           ];
           
           if (!builtIns.includes(symbolNode.name)) {
             foundDeps.add(symbolNode.name);
           }
         }
      }
    });
    
    return Array.from(foundDeps);
  } catch (e) {
    console.error("Error parsing formula variables:", e);
    return [];
  }
}