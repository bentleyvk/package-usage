import fetch from "node-fetch";

const companyName = process.argv[2];
const packageName = process.argv[3];
const azureToken = process.argv[4];

const token = `Basic ${Buffer.from(`:${azureToken}`).toString('base64')}`;

const API_URL = `https://almsearch.dev.azure.com/${companyName}/_apis/search/codeQueryResults?api-version=6.0-preview.1`;

// const search = async (packageName, skip, projectName) => {
//   const response = await fetch(API_URL, {
//     method: "POST",
//     body: JSON.stringify({
//       searchText: packageName,
//       skipResults: skip,
//       takeResults: 200,
//       filters: [],
//       searchFilters: projectName ? { ProjectFilters: [projectName] } : {},
//       sortOptions: [],
//       summarizedHitCountsNeeded: true,
//       includeSuggestions: false,
//       isInstantSearch: false,
//     }),
//     headers: { Authorization: token, "Content-Type": "application/json" },
//   });
//   const responseJson = await response.json();
//   return responseJson;
// };

const search = async (packageName, skip, projectName, repositoryName) => {
  const filter = {};
  if (projectName) {
    filter.ProjectFilters = [projectName];
  }
  if (repositoryName) {
    filter.RepositoryFilters = [repositoryName];
  }
  const response = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      searchText: packageName,
      skipResults: skip,
      takeResults: 200,
      filters: [],
      searchFilters: filter,
      sortOptions: [],
      summarizedHitCountsNeeded: true,
      includeSuggestions: false,
      isInstantSearch: false,
    }),
    headers: { Authorization: token, "Content-Type": "application/json" },
  });
  const responseJson = await response.json();
  return responseJson;
};

const getUsageForPackage = async (packageName) => {
  const initialResponse = await search(packageName, 0);
  const totalCount = initialResponse.results.count;
  let resultsProcessed = 0;
  const projects = initialResponse.filterCategories[0].filters.map((filter) => filter.id);
  const projectResults = initialResponse.filterCategories[0].filters.map((filter) => filter.resultCount);
  const appsUsing = [];
  for (let i = 0; i < projects.length; i++) {
    const projectName = projects[i];
    const initialProjectResponse = await search(packageName, 0, projectName);
    const repositories = initialProjectResponse.filterCategories[1].filters.map((filter) => filter.id);
    const repositoriesResults = initialProjectResponse.filterCategories[1].filters.map((filter) => filter.resultCount);
    for (let j = 0; j < repositories.length; j++) {
      const repositoryName = repositories[j];
      let skip = 0;
      while (skip < repositoriesResults[j]) {
        const response = await search(packageName, skip, projectName, repositoryName);
        appsUsing.push(
          ...response.results.values
            .filter((val) => {
              return val.fileName === "package.json";
            })
            .map((val) => val.repository)
        );
        skip = response.results.values.length + skip;
        resultsProcessed += response.results.values.length;
        process.stdout.write(`\r${packageName}: ${resultsProcessed} out of ${totalCount} files scanned.`);
      }
    }
  }
  process.stdout.write(`\n`);
  return new Set(appsUsing);
};

const main = async () => {
  try {
    console.log(packageName, await getUsageForPackage(packageName));
  } catch (error) {
    console.error("Something went wrong. It might be that your token expired.", error);
  }
};

main();
