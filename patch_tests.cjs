const fs = require('fs');
let code = fs.readFileSync('tests/analysis/AnalysisApp.test.ts', 'utf8');

// The test creates a mock FileReader but our new loadFile is async and awaits DataLoader's promise.
// We need to await app.loadFile in tests, but more importantly, we need the test to trigger reader.onload asynchronously or synchronously so the Promise resolves.

// We can just await the call if we change the test to `async () => { await app.loadFile... }` but the mock FileReader setup needs to immediately call onload or we need to manually trigger it and wait for microtasks.

// Let's modify the FileReader mock to call `onload` automatically when `readAsText` is called.

code = code.replace(
    /let capturedReader1: any;[\s\S]*?vi\.unstubAllGlobals\(\);/m,
    `class MockFileReader1 {
                readAsText = vi.fn().mockImplementation(function(this: any) {
                    setTimeout(() => {
                        if (this.onload) {
                            this.onload({ target: this });
                        }
                    }, 0);
                });
                onload: any = null;
                result = mockCSV;
            }
            vi.stubGlobal('FileReader', MockFileReader1);

            // Call loadFile
            await app.loadFile(mockFile);

            expect(app.frames.length).toBe(1);
            expect(app.frames[0].altitude).toBe(100);

            vi.unstubAllGlobals();`
);

code = code.replace(/it\('should correctly process valid CSV files', \(\) => \{/g, `it('should correctly process valid CSV files', async () => {`);

code = code.replace(
    /let capturedReader2: any;[\s\S]*?vi\.unstubAllGlobals\(\);/m,
    `class MockFileReader2 {
                readAsText = vi.fn().mockImplementation(function(this: any) {
                    setTimeout(() => {
                        if (this.onload) {
                            this.onload({ target: this });
                        }
                    }, 0);
                });
                onload: any = null;
                result = mockTXT;
            }
            vi.stubGlobal('FileReader', MockFileReader2);

            await app.loadFile(mockFile);

            expect(alertSpy).toHaveBeenCalledWith('Failed to parse file: Unsupported file type');
            expect(app.frames.length).toBe(0);

            vi.unstubAllGlobals();`
);

code = code.replace(/it\('should alert on unsupported file types', \(\) => \{/g, `it('should alert on unsupported file types', async () => {`);


code = code.replace(
    /let capturedReader3: any;[\s\S]*?vi\.unstubAllGlobals\(\);/m,
    `class MockFileReader3 {
                readAsText = vi.fn().mockImplementation(function(this: any) {
                    setTimeout(() => {
                        if (this.onload) {
                            this.onload({ target: this });
                        }
                    }, 0);
                });
                onload: any = null;
                result = mockEmptyCSV;
            }
            vi.stubGlobal('FileReader', MockFileReader3);

            await app.loadFile(mockFile);

            expect(alertSpy).toHaveBeenCalledWith('No valid frames found in file.');
            expect(app.frames.length).toBe(0);

            vi.unstubAllGlobals();`
);

code = code.replace(/it\('should alert when file is empty or has no valid frames', \(\) => \{/g, `it('should alert when file is empty or has no valid frames', async () => {`);


fs.writeFileSync('tests/analysis/AnalysisApp.test.ts', code);
