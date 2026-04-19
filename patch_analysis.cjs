const fs = require('fs');
let code = fs.readFileSync('src/analysis/AnalysisApp.ts', 'utf8');
code = code.replace(
    `import { FlightDataParser, FlightFrame } from './FlightDataParser';`,
    `import { FlightFrame } from './FlightDataParser';`
);
fs.writeFileSync('src/analysis/AnalysisApp.ts', code);
