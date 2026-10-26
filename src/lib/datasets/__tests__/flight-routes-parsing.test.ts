import { describe, it, expect } from 'vitest';
import { linkTargets, passengerDestinationsText } from '../generators/flight-routes';

const ARTICLE = `{{Infobox airport}}
Intro [[Red Sea]].
==History==
[[Cairo International Airport|Cairo]] opened earlier.
==Airlines and destinations==
===Passenger===
<!--DO NOT ADD ROUTES WITHOUT A SOURCE [[Fake Airport]]-->
{{Airport-dest-list
| [[Air Cairo]] | [[Frankfurt Airport|Frankfurt]],<ref name="a">{{Cite web|url=x|title=[[Ref Airport]]}}</ref> [[stuttgart Airport|Stuttgart]]<ref name="a"/>
| [[EasyJet]] | '''Seasonal:''' [[Geneva Airport#Terminal|Geneva]]
}}
===Cargo===
{{Airport-dest-list
| [[Cargo Air]] | [[Leipzig/Halle Airport|Leipzig]]
}}
==Statistics==
[[Munich Airport]]
`;

describe('Wikipedia route table parsing', () => {
  it('reads only the passenger destinations, without comments, references or cargo', () => {
    const links = linkTargets(passengerDestinationsText(ARTICLE));
    expect(links).toEqual(['Air Cairo', 'Frankfurt Airport', 'Stuttgart Airport', 'EasyJet', 'Geneva Airport']);
  });

  it('returns nothing for articles without a destinations section', () => {
    expect(passengerDestinationsText('==History==\n[[Frankfurt Airport]]')).toBe('');
  });
});
