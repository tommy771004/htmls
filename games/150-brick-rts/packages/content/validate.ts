import {rules, validateRules} from './rules.ts';
const errors=validateRules(rules,process.argv.includes('--exact'));
console.log(errors.length?errors.join('\n'):'PASS: design_default rules validated; reference coverage unknown.');
process.exitCode=errors.length?1:0;
