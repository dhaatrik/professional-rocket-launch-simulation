import { describe, it } from 'vitest';
import { VABEditor } from '../src/ui/VABEditor';

describe('VABEditor Perf', () => {
    it('measures render performance', () => {
        document.body.innerHTML = '<div id="test-container"></div>';
        const editor = new VABEditor('test-container', () => {});

        // Add multiple parts
        for (let i = 0; i < 5; i++) {
            editor.blueprint.stages.push({
                hasDecoupler: false,
                parts: Array(20).fill({ part: { id: 'test', name: 'Test', mass: 10, category: 'tank' }, instanceId: '123' })
            });
        }

        console.time('render-optimized');
        for (let i = 0; i < 200; i++) {
            editor['render']();
        }
        console.timeEnd('render-optimized');
    }, 30000);
});
