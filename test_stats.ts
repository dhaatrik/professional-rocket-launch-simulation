import { createFalconPreset, calculateStats } from './src/vab/VehicleBlueprint';
const bp = createFalconPreset();
const stats = calculateStats(bp);
console.log('Original wetMass:', stats.wetMass);
console.log('Original Stage Delta-V:', stats.stageDeltaV);
console.log('Original Stage TWR:', stats.stageTWR);
