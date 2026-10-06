/** Annual local-calendar season, inclusive of both 15 November and 6 January.
 * Resolve this once per ride; the host's captured value is shared by both racers. */
export function isChristmasSeason(date=new Date()) {
  const month=date.getMonth(),day=date.getDate();
  return month===10&&day>=15||month===11||month===0&&day<=6;
}
export function christmasEnabled(search=typeof location==='undefined'?'':location.search,date=new Date()) {
  return new URLSearchParams(search).get('christmas')==='1'||isChristmasSeason(date);
}
