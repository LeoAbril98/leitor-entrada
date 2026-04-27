import { getWheelPhotoUrl } from './src/utils/photoUtils';

console.log("Testing Photo Matching Logic with Real Model Codes...");

const tests = [
    { desc: "G1741 17 4F GF", expected: "GF", avoid: "GFD" },
    { desc: "K63 15-17 GFD", expected: "GFD", avoid: "NONE" },
    { desc: "C10 15X10 4F BD", expected: "BD", avoid: "NONE" }
];

tests.forEach(t => {
    const url = getWheelPhotoUrl(t.desc);
    console.log(`Description: ${t.desc}`);
    console.log(`URL: ${url}`);
    
    const hasExpected = url.toUpperCase().includes(t.expected);
    const avoidedConflict = t.avoid === "NONE" || !url.toUpperCase().includes(t.avoid);
    
    const isOk = hasExpected && avoidedConflict;
    console.log(`Match ${t.expected}: ${isOk ? "✅" : "❌"}`);
    if (!isOk) {
        if (!hasExpected) console.log(`  - Missing ${t.expected}`);
        if (!avoidedConflict) console.log(`  - Included ${t.avoid} incorrectly`);
    }
    console.log("---");
});
