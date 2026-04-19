const fs = require('fs');
let code = fs.readFileSync('tests/analysis/AnalysisApp.test.ts', 'utf8');

code = code.replace(
    /result = mockTXT;/g,
    `result = 'mock content';`
);

code = code.replace(
    /result = mockEmptyCSV;/g,
    `result = 'timestamp,missionTime,altitude,velocity\n';`
);

fs.writeFileSync('tests/analysis/AnalysisApp.test.ts', code);
