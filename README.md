# package-usage

Here you will find scripts that allow you to get a package usage statistics. 

## Use

Firstly you need to run:
```
npm install
```

### Azure token

In order to use scripts you need to get an Azure token.
1. Go to your company's Azure DevOps page.
2. Open "Personal access tokens" page

    ![Dropdown menu with "Personal access tokens" highlighted](/docs/azure-token1.png)
3. Click "New Token"

    !["New Token" highlighted](/docs/azure-token2.png)
4. Give token a name, select "Read" permission under "Code" and click "Create"

    !["Read" permission under "Code" highlighted](/docs/azure-token3.png)
5. Save your token in the safe place for later use.

### Package usage statistics

In order to get specific package usage run this command:
```
node package-usage.js companyName packageName azureToken
```

`companyName` - name of your company, you can just copy it from the URL `https://dev.azure.com/companyName/`.

`packageName` - name of the package that you want to get statistics.

`azureToken` - Azure token that you got from previous [step](#azure-token).

### Components usage statistics

In order to get statistics of components usage per project, you need to run:
```
node components-usage.js companyName packageName azureToken
```

It will create a file `repositoryComponentsMap-package-name.json` which contains an object where key is a repo name and value is object where `components` is an object with keys being components name and components usage as values, there is also `lastModifiedDate` that can be used to determine whether repo is stale.

Then you can run your own scripts on this file or you can also call `node summary-component-usage.js` (firstly you need to change hardcoded components inside, sorry) and you will get `.csv` file with unique components count used in the repos.
