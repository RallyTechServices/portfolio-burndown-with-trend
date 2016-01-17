#Portfolio Item Burnup With Trend

A change to the PI Burnup app from the catalog:

* Adds a trend line to the scope to determine the likely end date
** The trend line is a simple calculation from the first accepted through today's value to the crossing of the scope line.
** The trend line does not take into account variation in scope.  It's a simple intersection with the line of today's value into eternity.
** The trend line does not take into account instances where completed is removed, except to the extent that the current completed is higher than the first completed.
* The trend line will not show if one of the following is true:
** Today is not on the chart
** There have not been at least two days with completed items
** Today is a lower completed value than the first completed value (won't calculate a negative slope)
* Puts a line on the chart to indicate the day the app is run, the planned 
end date, and the potential end date
* Stops showing the burn up after today because that's future information that
isn't guaranteed.

* Now allows multiple portfolio items.  Start and End dates are taken from those that have those values (earliest of each item for start and latest of each for end).  


## Development Notes

* Made a switch on the calculator config to decide whether to show after today (only the completion bars).
* The calculator is determining the plotlines but they're added to the chart using snapshotsAggregated listener on the rallychart
* An example of grabbing the chart after the fact


### First Load

If you've just downloaded this from github and you want to do development, 
you're going to need to have these installed:

 * node.js
 * grunt-cli
 * grunt-init
 
Since you're getting this from github, we assume you have the command line
version of git also installed.  If not, go get git.

If you have those three installed, just type this in the root directory here
to get set up to develop:

  npm install

### Structure

  * src/javascript:  All the JS files saved here will be compiled into the 
  target html file
  * src/style: All of the stylesheets saved here will be compiled into the 
  target html file
  * test/fast: Fast jasmine tests go here.  There should also be a helper 
  file that is loaded first for creating mocks and doing other shortcuts
  (fastHelper.js) **Tests should be in a file named <something>-spec.js**
  * test/slow: Slow jasmine tests go here.  There should also be a helper
  file that is loaded first for creating mocks and doing other shortcuts 
  (slowHelper.js) **Tests should be in a file named <something>-spec.js**
  * templates: This is where templates that are used to create the production
  and debug html files live.  The advantage of using these templates is that
  you can configure the behavior of the html around the JS.
  * config.json: This file contains the configuration settings necessary to
  create the debug and production html files.  Server is only used for debug,
  name, className and sdk are used for both.
  * package.json: This file lists the dependencies for grunt
  * auth.json: This file should NOT be checked in.  Create this to run the
  slow test specs.  It should look like:
    {
        "username":"you@company.com",
        "password":"secret"
    }
  
### Usage of the grunt file
####Tasks
    
##### grunt debug

Use grunt debug to create the debug html file.  You only need to run this when you have added new files to
the src directories.

##### grunt build

Use grunt build to create the production html file.  We still have to copy the html file to a panel to test.

##### grunt test-fast

Use grunt test-fast to run the Jasmine tests in the fast directory.  Typically, the tests in the fast 
directory are more pure unit tests and do not need to connect to Rally.

##### grunt test-slow

Use grunt test-slow to run the Jasmine tests in the slow directory.  Typically, the tests in the slow
directory are more like integration tests in that they require connecting to Rally and interacting with
data.
