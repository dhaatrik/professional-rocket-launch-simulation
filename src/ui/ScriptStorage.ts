import { parseMissionScript, MissionScript } from '../guidance/FlightScript';

const STORAGE_KEY = 'rocket-sim-scripts';

export type SavedScriptsRecord = Record<string, { text: string; script: MissionScript }>;

export class ScriptStorage {
    /**
     * Get saved scripts from localStorage
     */
    static getSavedScripts(): SavedScriptsRecord {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return {};

            const parsed = JSON.parse(stored);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                return {};
            }

            const validScripts: SavedScriptsRecord = {};

            for (const key of Object.keys(parsed)) {
                const entry = parsed[key];
                if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;

                if (typeof entry.text !== 'string') continue;

                const rawScript = entry.script;
                if (!rawScript || typeof rawScript !== 'object' || Array.isArray(rawScript)) continue;
                if (typeof rawScript.name !== 'string') continue;
                if (typeof rawScript.createdAt !== 'number') continue;

                // Re-parse the text to safely reconstruct the script object
                // This prevents prototype pollution and ensures absolute schema validity
                const parseResult = parseMissionScript(entry.text, rawScript.name);
                if (parseResult.success && parseResult.script) {
                    validScripts[key] = {
                        text: entry.text,
                        script: {
                            name: rawScript.name,
                            commands: parseResult.script.commands,
                            createdAt: rawScript.createdAt
                        }
                    };
                }
            }

            return validScripts;
        } catch {
            return {};
        }
    }

    /**
     * Save a script to localStorage
     */
    static saveScript(name: string, scriptText: string, script: MissionScript): boolean {
        try {
            const scripts = this.getSavedScripts();
            scripts[name] = {
                text: scriptText,
                script: script
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
            return true;
        } catch (e) {
            console.error('Failed to save script', e);
            return false;
        }
    }

    /**
     * Delete a script from localStorage
     */
    static deleteScript(name: string): boolean {
        try {
            const scripts = this.getSavedScripts();
            if (scripts[name]) {
                delete scripts[name];
                localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
                return true;
            }
            return false;
        } catch (e) {
            console.error('Failed to delete script', e);
            return false;
        }
    }
}
