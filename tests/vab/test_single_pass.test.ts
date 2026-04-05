import { describe, it, expect } from 'vitest';
import { calculateStats as calculateStatsOrig, createFalconPreset, createSimplePreset, VehicleBlueprint, VehicleStats } from '../../src/vab/VehicleBlueprint';

const G = 9.81;

function calculateStatsOpt(blueprint: VehicleBlueprint): VehicleStats {
    let dryMass = 0;
    let fuelMass = 0;
    let totalHeight = 0;
    let totalCost = 0;
    let hasAvionics = false;
    let hasFairing = false;

    const stageDeltaV: number[] = [];
    const stageTWR: number[] = [];
    let totalDeltaV = 0;

    // The original code calculated total wetMass first, then processed top-to-bottom.
    // Let's try to mimic the EXACT m0 logic without knowing wetMass up front.
    // In original code, remainingMass starts at wetMass.
    // For i = length-1: m0 = wetMass, mf = wetMass - fuel[length-1], remainingMass = wetMass - total[length-1].
    // This means m0 for any stage `i` is the sum of total mass for stages 0 through `i`.
    // Wait. If `wetMass` is the sum of all stages 0 to length-1...
    // And remainingMass is reduced by stage[i] total mass...
    // Then for stage `i`, `remainingMass` (m0) is exactly the sum of total masses of stages 0 through `i`!
    // Let's test this hypothesis!

    // We can do this in a forward pass (0 to length-1).
    // Let's accumulate `accumulatedMass` which will be the sum of stages 0 through `i`.
    // Wait, if we process forward, we need to KNOW the accumulated mass up to `i`.
    // If we just keep a running total as we go forward, at stage `i`, the running total is the sum of 0 through `i`.
    // Yes!

    let runningMass = 0;

    for (let i = 0; i < blueprint.stages.length; i++) {
        const stage = blueprint.stages[i];
        if (!stage) continue;

        let stageThrust = 0;
        let stageIsp = 0;
        let stageFuel = 0;
        let stageDry = 0;
        let engineCount = 0;

        for (const inst of stage.parts) {
            const part = inst.part;
            stageDry += part.mass;
            totalHeight += part.height;
            totalCost += part.cost;

            if (part.thrust && part.ispVac) {
                stageThrust += part.thrust;
                stageIsp += part.ispVac;
                engineCount++;
            }
            if (part.fuelCapacity) {
                stageFuel += part.fuelCapacity;
            }
            if (part.sasCapable) {
                hasAvionics = true;
            }
            if (part.category === 'fairing') {
                hasFairing = true;
            }
        }

        if (stage.hasDecoupler) {
            stageDry += 50;
            totalHeight += 5;
            totalCost += 100;
        }

        dryMass += stageDry;
        fuelMass += stageFuel;

        if (engineCount > 0) {
            stageIsp /= engineCount;
        }

        // The exact mathematical equivalent of original reverse loop's `remainingMass`
        // before subtraction is `sum(totalMass for j=0..i)`.
        const stageTotal = stageDry + stageFuel;
        runningMass += stageTotal;

        const m0 = runningMass;
        const mf = m0 - stageFuel;

        let dv = 0;
        if (stageIsp > 0 && mf > 0 && m0 > mf) {
            dv = stageIsp * G * Math.log(m0 / mf);
        }

        let twr = 0;
        if (stageThrust > 0 && m0 > 0) {
            twr = stageThrust / (m0 * G);
        }

        // The original code used `stageDeltaV.unshift()`, but processed in reverse order (length-1 down to 0).
        // Since we are processing in FORWARD order (0 up to length-1), and we want the same final array order,
        // we should use `.unshift()`.
        // Wait, if original processed `1` then `0`, and unshifted, the array was `[0, 1]`.
        // If we process `0` then `1`, to get `[0, 1]`, we must `push()`.
        // Let's use push.
        stageDeltaV.push(dv);
        stageTWR.push(twr);
        totalDeltaV += dv;
    }

    const wetMass = dryMass + fuelMass;

    return {
        dryMass,
        fuelMass,
        wetMass,
        totalHeight,
        totalCost,
        stageDeltaV,
        totalDeltaV,
        stageTWR,
        hasAvionics,
        hasFairing
    };
}

describe('calculateStats verification', () => {
    it('matches exact output for Falcon Preset', () => {
        const bp = createFalconPreset();
        const orig = calculateStatsOrig(bp);
        const opt = calculateStatsOpt(bp);
        expect(opt).toEqual(orig);
    });

    it('matches exact output for Simple Preset', () => {
        const bp = createSimplePreset();
        const orig = calculateStatsOrig(bp);
        const opt = calculateStatsOpt(bp);
        expect(opt).toEqual(orig);
    });
});
