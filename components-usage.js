import fetch from "node-fetch";
import fs from "fs";

const companyName = process.argv[2];
const packageName = process.argv[3];
const azureToken = process.argv[4];

const token = `Basic ${Buffer.from(`:${azureToken}`).toString('base64')}`;

const SEARCH_API_URL =
  `https://almsearch.dev.azure.com/${companyName}/_apis/search/codeQueryResults?api-version=6.0-preview.1`;

const getFileContent = async (file) => {
  const response = await fetch(
    `https://dev.azure.com/${companyName}/${file.projectId}/_apis/git/repositories/${
      file.repositoryId
    }/Items?path=${encodeURI(
      file.path
    )}&recursionLevel=0&includeContentMetadata=true&latestProcessedChange=false&download=false&versionDescriptor%5BversionOptions%5D=0&versionDescriptor%5BversionType%5D=2&versionDescriptor%5Bversion%5D=${
      file.changeId
    }&includeContent=true&resolveLfs=true`,
    {
      method: "GET",
      headers: { Authorization: token, "Content-Type": "application/json" },
    }
  );
  return await response.text();
};

const search = async (packageName, skip, projectName, repositoryName) => {
  const filter = {};
  if (projectName) {
    filter.ProjectFilters = [projectName];
  }
  if (repositoryName) {
    filter.RepositoryFilters = [repositoryName];
  }
  const response = await fetch(SEARCH_API_URL, {
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

const getReactFiles = async (packageName) => {
  const initialResponse = await search(packageName, 0);
  const totalCount = initialResponse.results.count;
  let resultsProcessed = 0;
  const projects = initialResponse.filterCategories[0].filters.map((filter) => filter.id);
  const projectResults = initialResponse.filterCategories[0].filters.map((filter) => filter.resultCount);
  const reactFiles = [];
  for (let i = 0; i < projects.length; i++) {
    const projectName = projects[i];
    if (projectResults[i] < 1000) {
      let skip = 0;
      while (skip < projectResults[i]) {
        const response = await search(packageName, skip, projectName);
        reactFiles.push(
          ...response.results.values.filter((val) => {
            return val.fileName.endsWith(".jsx") || val.fileName.endsWith(".tsx");
          })
        );
        skip = response.results.values.length + skip;
        resultsProcessed += response.results.values.length;
        process.stdout.write(`\r${packageName}: ${resultsProcessed} out of ${totalCount} search results scanned.`);
      }
    } else {
      const initialProjectResponse = await search(packageName, 0, projectName);
      const repositories = initialProjectResponse.filterCategories[1].filters.map((filter) => filter.id);
      const repositoriesResults = initialProjectResponse.filterCategories[1].filters.map(
        (filter) => filter.resultCount
      );
      for (let j = 0; j < repositories.length; j++) {
        const repositoryName = repositories[j];
        let skip = 0;
        while (skip < repositoriesResults[j]) {
          const response = await search(packageName, skip, projectName, repositoryName);
          if (!response.results) {
            console.log(results);
          }
          reactFiles.push(
            ...response.results.values.filter((val) => {
              return val.fileName.endsWith(".jsx") || val.fileName.endsWith(".tsx");
            })
          );
          skip += response.results.values.length;
          resultsProcessed += response.results.values.length;
          process.stdout.write(`\r${packageName}: ${resultsProcessed} out of ${totalCount} search results scanned.`);
        }
      }
    }
  }
  process.stdout.write(`\n`);
  return reactFiles;
};

const getMappedComponents = (fileContent, packageName) => {
  const componentRegex = new RegExp(
    `import[\\s*\\n*]{([^}]*)}[\\s*\\n*]from[\\s*\\n*]['"]${packageName}|import[\\s*\\n*](.*|\\n*)[\\s*\\n*]from[\\s*\\n*]['"]${packageName}`,
    "g"
  );
  const componentsList = [];
  let match = componentRegex.exec(fileContent);
  while (match != null) {
    componentsList.push(
      ...(match[1] || match[2]).split(",").map((val) => {
        const res = val.trim().split(" as ")[0].replace("\n", "").replace("\r", "").trim();
        if (res === "") {
          console.log(val);
        }
        return res;
      })
    );
    match = componentRegex.exec(fileContent);
  }
  const mappedComponents = {};
  componentsList.forEach((component) => {
    if (!mappedComponents[component]) {
      mappedComponents[component] = 1;
    } else {
      mappedComponents[component] = mappedComponents[component] + 1;
    }
  });
  return mappedComponents;
};

const repositoryLastModifiedDateCache = {};
const repositoryLastModifiedDate = async (project, repositoryId) => {
  if (repositoryLastModifiedDateCache[`${project}-${repositoryId}`]) {
    return repositoryLastModifiedDateCache[`${project}-${repositoryId}`];
  }

  const response = await fetch(
    `https://dev.azure.com/${companyName}/${project}/_apis/git/repositories/${repositoryId}/pushes?api-version=6.0&$top=1`,
    {
      method: "GET",
      headers: { Authorization: token, "Content-Type": "application/json" },
    }
  );
  if (!response.ok) {
    return null;
  }
  const responseJson = await response.json();
  if (!responseJson.value) {
    console.log(responseJson);
  }
  return responseJson.value?.[0]?.date;
};

const sanitizePackageName = (packageName) => packageName.replace("@", "").replace("/", "-");

const main = async () => {
  try {
    const reactFiles = await getReactFiles(packageName);
    // const reactFiles = JSON.parse(fs.readFileSync(`./react-components-${sanitizePackageName(packageName)}.json`, "utf8"));
    console.log("Files found:", reactFiles.length);
    fs.writeFileSync(
      `./react-components-${sanitizePackageName(packageName)}.json`,
      JSON.stringify(reactFiles, null, 2)
    );
    const repositoryComponentsMap = {};
    for (let i = 0; i < reactFiles.length; i++) {
      const file = reactFiles[i];
      const fileContent = await getFileContent(file);
      // console.log(fileContent);
      const mappedComponents = getMappedComponents(fileContent, packageName);
      // console.log(mappedComponents);
      process.stdout.clearLine?.(); // clear current text
      process.stdout.cursorTo?.(0); // move cursor to beginning of line
      process.stdout.write(
        `${i + 1} out of ${reactFiles.length} React files scanned. Current file: ${file.project} -> ${
          file.repository
        } -> ${file.fileName}`
      );
      // console.log(file.fileName)
      const lastModifiedDate = await repositoryLastModifiedDate(file.projectId, file.repositoryId);
      Object.keys(mappedComponents).forEach((component) => {
        if (!repositoryComponentsMap[file.repository]) {
          repositoryComponentsMap[file.repository] = { components: {}, lastModifiedDate: lastModifiedDate };
        }
        if (!repositoryComponentsMap[file.repository].components[component]) {
          repositoryComponentsMap[file.repository].components[component] = mappedComponents[component];
        } else {
          repositoryComponentsMap[file.repository].components[component] =
            repositoryComponentsMap[file.repository].components[component] + mappedComponents[component];
        }
      });
    }
    console.log();
    console.log("Final", repositoryComponentsMap);
    fs.writeFileSync(
      `./repositoryComponentsMap-${sanitizePackageName(packageName)}.json`,
      JSON.stringify(repositoryComponentsMap)
    );
  } catch (error) {
    console.log(error);
    console.error("Something went wrong. It might be that your token expired.");
  }
};

main();
