import { getDef, loadLocal } from '@d2api/manifest-node';
import { uniqAndSortArray, writeFile } from './helpers.js';

loadLocal();

/**
 * NB Spider used to be the materials exchange vendor but the materials
 * exchange has moved to Rahool in the tower. Keeping the spider file names
 * to reduce churn for consumers of the data, because the concept is the same.
 */

const rahoolMatsWithIndex: {
  hash: number;
  index: number;
}[] = [];
const rahoolMats: number[] = [];

const DENY_HASHES = [1022552290];
const GLIMMER_HASHES = [3159615086, 3664001560];
const indexFixList = ['Phaseglass Needle', 'Baryon Bough'];

const rahool = getDef('Vendor', 2255782930);

rahool?.itemList.flatMap((i) => {
  if (GLIMMER_HASHES.includes(i.itemHash)) {
    if (!DENY_HASHES.includes(i.currencies[0].itemHash)) {
      const item = getDef('InventoryItem', i.currencies[0].itemHash)!;
      const hash = item.hash;
      const name = item.displayProperties.name;
      const index = item.index;
      if (!rahoolMatsWithIndex.some((j) => j.hash === hash)) {
        rahoolMatsWithIndex.push({
          hash: hash,
          index: indexFixList.some((iFix) => name.includes(iFix)) ? index + 16 : index,
        });
      }
    }
  }
});

/*
This is the sort we want, based on season and location.

hash       | name             | season | location | index |
-----------|------------------|--------|----------|-------|
950899352  | dusklight shard  | 1      | edz      | 2513  |
2014411539 | alkane dust      | 1      | titan    | 2516  |
3487922223 | datalattice      | 1      | nessus   | 2524  |
1305274547 | phaseglass       | 1      | io       | 2510  | *
49145143   | sim seed         | 2      | mercury  | 3706  |
31293053   | seraphite        | 3      | mars     | 4590  |
1177810185 | etheric spiral   | 4      | tangled  | 5791  |
592227263  | baryon bough     | 4      | dreaming | 5789  | *
3592324052 | helium filaments | 8      | moon     | 10368 |
293622383  | spinmetal leaves |        | cosmo    | 12041 |
1485756901 | glacial starwort |        | europa   | 12042 |

*/

rahoolMatsWithIndex.sort((a, b) => a.index - b.index);

Object.values(rahoolMatsWithIndex).forEach((item) => {
  rahoolMats.push(item.hash);
});

const validRahoolCurrencies = [
  ...new Set(
    rahool?.itemList.flatMap((i) =>
      i.currencies.map(
        (c) => [c.itemHash, getDef('InventoryItem', c.itemHash)?.displayProperties.name] as const
      )
    ) ?? []
  ),
];
const purchaseableCurrencyItems = rahool?.itemList.filter((i) => {
  const def = getDef('InventoryItem', i.itemHash)?.displayProperties.name;
  if (
    def?.startsWith('Purchase ') &&
    validRahoolCurrencies.find(
      ([, matName]) =>
        matName?.includes(def.replace('Purchase ', '')) || (matName && def.includes(matName))
    )
  ) {
    return true;
  }
});
const purchaseableMatTable: NodeJS.Dict<number> = {};
purchaseableCurrencyItems?.forEach((i) => {
  const def = getDef('InventoryItem', i.itemHash)!.displayProperties.name;
  purchaseableMatTable[i.itemHash] = validRahoolCurrencies.find(
    ([, matName]) =>
      matName?.includes(def.replace('Purchase ', '')) || (matName && def.includes(matName))
  )![0];
});

writeFile('./output/spider-mats.json', uniqAndSortArray(rahoolMats));
writeFile('./output/spider-purchaseables-to-mats.json', purchaseableMatTable);
