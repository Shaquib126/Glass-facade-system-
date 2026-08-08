const tz = 'Asia/Calcutta';
const d = new Date();
const dateOpts = { timeZone: tz };
console.log(d.toLocaleDateString('en-CA', dateOpts));
