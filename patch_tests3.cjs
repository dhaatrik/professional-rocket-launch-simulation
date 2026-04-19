const fs = require('fs');
let code = fs.readFileSync('tests/analysis/AnalysisApp.test.ts', 'utf8');

code = code.replace(
    /result = 'timestamp,missionTime,altitude,velocity\n';/g,
    `result = 'timestamp,missionTime,altitude,velocity\\n';`
);

fs.writeFileSync('tests/analysis/AnalysisApp.test.ts', code);
