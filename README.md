### Using the wow API to track and trend rating change in World of Warcraft. Eventually to build up a dataset large enough to be able to track a players "playing time" as in what time of day are they queing the most as well as to trend are there better times to que to see positive rating change in your region. This is the end goal but is far from implementation at this point. v0.1.



Runnable commands in current build 

  Commands you can run:

  # `Single poll (test it first)`
  `npm run track:once`

  `Continuous tracking (polls every 5 minutes)`
  `npm run track`

  # `View collected stats and time-of-day analysis`
  `npm run stats`

  Go ahead and reopen your terminal with the correct nvm, then test with:

  npm run track:once

  This will take an initial snapshot. Run it again after playing some games and it will detect the changes and record the timestamp.
