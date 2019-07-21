/*================================================================================================================================*\
||
|| categorizeSources()
|| converts manifest's sourceHashes and sourceStrings into DIM filters according to categories.json rules
||
\*================================================================================================================================*/
const { writeFile, writeFilePretty, getMostRecentManifest, prettier } = require('./helpers.js');
const stringifyObject = require('stringify-object');

const mostRecentManifestLoaded = require(`./${getMostRecentManifest()}`);

let inventoryItem = mostRecentManifestLoaded.DestinyInventoryItemDefinition;
let collectibles = mostRecentManifestLoaded.DestinyCollectibleDefinition;

const newSource = {};

Object.keys(collectibles).forEach(function(key) {
  const hash = collectibles[key].sourceHash;
  const sourceName = collectibles[key].sourceString
    ? collectibles[key].sourceString
    : collectibles[key].displayProperties.description;
  if (hash) {
    // Only add sources that have an existing hash (eg. no classified items)
    newSource[hash] = sourceName;
  }
});

writeFilePretty('./output/sources.json', newSource);
categorizeSources();

function categorizeSources() {
  let categories = require('./data/categories.json');
  let sourcesInfo = {};
  let D2Sources = {
    // the result for pretty printing
    SourceList: [],
    Sources: {}
  };

  // sourcesInfo built from manifest collectibles
  Object.values(collectibles).forEach(function(collectible) {
    if (collectible.sourceHash) {
      sourcesInfo[collectible.sourceHash] = collectible.sourceString;
    }
  });

  // add any manual exceptions from categories.json
  categories.exceptions.forEach(function(exceptionTuple) {
    sourcesInfo[exceptionTuple[0]] = exceptionTuple[1];
  });

  // loop through categorization rules
  Object.entries(categories.sources).forEach(function(category) {
    // initialize this source's object
    D2Sources.SourceList.push(category[0]);
    D2Sources.Sources[category[0]] = {
      itemHashes: [],
      sourceHashes: []
    };

    // string match this category's source descriptions
    D2Sources.Sources[category[0]].sourceHashes = objectSearchValues(sourcesInfo, category[1]);
    if (!D2Sources.Sources[category[0]].sourceHashes.length) {
      console.log(`no matching sources for: ${category[1]}`);
    }

    // add individual items if available for this category
    if (categories.items[category[0]]) {
      categories.items[category[0]].forEach(function(itemName) {
        Object.entries(inventoryItem).forEach(function(entry) {
          if (entry[1].displayProperties.name === itemName) {
            D2Sources.Sources[category[0]].itemHashes.push(entry[0]);
          }
        });
      });
    }
  });

  let pretty = `const Sources = ${stringifyObject(D2Sources, {
    indent: '  '
  })};\n\nexport default Sources;`;

  // annotate the file with sources or item names next to matching hashes
  let annotated = pretty.replace(/'(\d{2,})',?/g, function(match, submatch) {
    if (sourcesInfo[submatch]) {
      return `${Number(submatch)}, // ${sourcesInfo[submatch]}`;
    }
    if (inventoryItem[submatch]) {
      return `${Number(submatch)}, // ${inventoryItem[submatch].displayProperties.name}`;
    }
    console.log(`unable to find information for hash ${submatch}`);
    return `${Number(submatch)}, // could not identify hash`;
  });

  writeFile('./output/source-info.ts', annotated);
  prettier('./output/source-info.ts');
}

function objectSearchValues(haystack, searchTermArray) {
  var searchResults = [];
  const includes = searchTermArray.includes;
  const excludes = searchTermArray.excludes;
  Object.entries(haystack).forEach(function(entry) {
    includes.forEach(function(searchTerm) {
      let noExceptionFound = true;
      if (entry[1].toLowerCase().includes(searchTerm.toLowerCase())) {
        if (excludes && excludes.length) {
          excludes.forEach(function(exclude) {
            if (entry[1].toLowerCase().includes(exclude.toLowerCase())) {
              noExceptionFound = false;
            }
          });
        }
        if (noExceptionFound) {
          searchResults.push(entry[0]);
        }
      }
    });
  });
  return [...new Set(searchResults)];
}
