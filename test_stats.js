const { createFalconPreset, calculateStats } = require('./src/vab/VehicleBlueprint.ts');
const bp = createFalconPreset();
const stats = calculateStats(bp);
console.log('Stage Delta-V:', stats.stageDeltaV);
console.log('Stage TWR:', stats.stageTWR);
