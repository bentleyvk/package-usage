import fs from "fs";

const getStatistics = (usageMap, isActiveIn30Days) => {
  const statistics = {};
  Object.keys(usageMap)
    .filter(
      (project) =>
        !isActiveIn30Days || new Date(usageMap[project].lastModifiedDate) >= Date.now() - 30 * 24 * 60 * 60 * 1000
    )
    .forEach((project) => {
      statistics[project] = Object.keys(usageMap[project].components).filter(
        (key) => !key.toLowerCase().startsWith("svg")
      ).length;
    });
  return statistics;
};

const getUsageStatistics = (itwinuiUsage, bwcUsage, uiCoreUsage, coreReactUsage, isActiveIn30Days) => {
  const itwinuiStatistics = getStatistics(itwinuiUsage, isActiveIn30Days);
  const bwcStatistics = getStatistics(bwcUsage, isActiveIn30Days);
  const uiCoreStatistics = getStatistics(uiCoreUsage, isActiveIn30Days);
  const coreReactStatistics = getStatistics(coreReactUsage, isActiveIn30Days);

  const usageStatistics = {};
  Object.keys({ ...bwcStatistics, ...itwinuiStatistics, ...uiCoreStatistics }).forEach((project) => {
    usageStatistics[project] = [
      bwcStatistics[project],
      itwinuiStatistics[project],
      uiCoreStatistics[project],
      coreReactStatistics[project],
    ];
  });
  console.log(usageStatistics);

  return usageStatistics;
};

const writeToFile = (usageStatistics, fileName) => {
  let csvFile =
    "Project,BWC unique components,iTwinUI unique components,ui-core unique components,core-react unique components\n";
  Object.keys(usageStatistics).forEach((project) => {
    csvFile += `${project},${usageStatistics[project].map((count) => count || 0).join(",")}\n`;
  });
  fs.writeFileSync(fileName, csvFile);
};

const itwinuiUsage = JSON.parse(fs.readFileSync("./repositoryComponentsMap-itwin-itwinui-react.json"));
const bwcUsage = JSON.parse(fs.readFileSync("./repositoryComponentsMap-bentley-bwc-react.json"));
const uiCoreUsage = JSON.parse(fs.readFileSync("./repositoryComponentsMap-bentley-ui-core.json"));
const coreReact = JSON.parse(fs.readFileSync("./repositoryComponentsMap-itwin-core-react.json"));

const usageStatistics = getUsageStatistics(itwinuiUsage, bwcUsage, uiCoreUsage, coreReact, false);
const usageStatisticsActive30Days = getUsageStatistics(itwinuiUsage, bwcUsage, uiCoreUsage, coreReact, true);

writeToFile(usageStatistics, "./usageStatistics.csv");
writeToFile(usageStatisticsActive30Days, "./usageStatisticsActive30Days.csv");
