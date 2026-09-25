import {writeFileSync} from 'node:fs';
import {rules,validateRules} from './rules.ts';
const errors=validateRules(rules);if(errors.length)throw Error(errors.join('\n'));
writeFileSync(new URL('../../docs/ruleset-manifest.json',import.meta.url),JSON.stringify(rules,null,2)+'\n');
