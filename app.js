const builder = require('botbuilder');
const restify = require('restify');
let conf;
try { conf = require('./keys.js'); } catch (err) { conf = {}; }

// Setup Restify Server
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, () => {
  console.log(`${server.name} listening to ${server.url}`);
});

const connector = new builder.ChatConnector({
  appId: process.env.appIdAzure || conf.appIdAzure,
  appPassword: process.env.appSecretAzure || conf.appSecretAzure
});
server.post('/api/messages', connector.listen());

const bot = new builder.UniversalBot(connector);

const luisModelUrl = `https://${process.env.luisAPIHostName || conf.luisAPIHostName}/luis/v2.0/apps/${process.env.luisAppId || conf.luisAppId}?subscription-key=${process.env.luisAPIKey || conf.luisAPIKey}`;

const recognizer = new builder.LuisRecognizer(luisModelUrl);
const intents = new builder.IntentDialog({
  recognizers: [recognizer]
});

bot.dialog('/', intents);

intents.matches('Greet', (session, args, next) => {
  session.send(`Hello there! I'm eva, the movie ticket booking bot. How can I help you today?`);
});

const movies = ['Avengers', 'Jurassic World', 'Rampage', 'The Incredibles 2'];
function getMoviesToDisplay() {
  return movies.join('\n- ');
}
intents.matches('ShowNowPlaying', (session, args, next) => {
  session.send(`Sure, here is the list of the movies currently playing:${getMoviesToDisplay()}`);
});

intents.matches('BookTicket', [
  (session, args, next) => {
    const movieEntity = args.entities.filter((e => e.type === 'Movies'));
    const nTicketsEntity = args.entities.filter(e => e.type === 'builtin.number');
  
    if (movieEntity.length > 0) {
      session.userData.movie = movieEntity[0].resolution.values[0];
    } else {
      delete session.userData.movie;
    }
    
    if (nTicketsEntity.length > 0) {
      session.userData.nTickets = nTicketsEntity[0].resolution.value;
    } else {
      delete session.userData.nTickets;
    }
  
    if (!session.userData.movie) {
      session.beginDialog('askMovie');
    } else {
      next();
    }
  },
  (session, args, next) => {
    if (!session.userData.nTickets) {
      session.beginDialog('askNoOfTickets');
    } else {
      next();
    }
  },
  (session, args, next) => {
    session.send(`Sure, I have booked you ${session.userData.nTickets} tickets for ${session.userData.movie}. Have fun!.`);
  }
]);

bot.dialog('askMovie', [
  (session, args, next) => {
    builder.Prompts.choice(session, `What movie would you like to whatch?`, movies);
  },
  (session, args, next) => {
    session.userData.movie = args.response.entity;
    session.endDialogWithResult(args);
  }
]);

bot.dialog('askNoOfTickets', [
  (session, args, next) => {
    builder.Prompts.number(session, `Great! How many tickets would you like to book?`);
  },
  (session, args, next) => {
    session.userData.nTickets = args.response;
    session.endDialogWithResult(args);
  }
]);