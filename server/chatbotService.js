const axios = require('axios');
const _ = require('lodash');

const natural = require('natural');
const tokenizer = new natural.WordTokenizer();

const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat')
dayjs.extend(customParseFormat);

const Amadeus = require('amadeus');
const amadeus = new Amadeus({
    clientId: 'PUKNUmX9i3wfAhefJGP7A5BjQ0UWBjmk',
    clientSecret: 'e9bDlugGJgvhAxpd'
});

class ChatBot {
    static state = {
        countries: [],
        country: null,
        cities: [],
        city: null,
        purpose: null,
        current_intent: null,
        people: {
            adults: 1,
            children: 0
        },
        rooms: 1,
        check_in_date: dayjs().format('YYYY-MM-DD'),
        check_out_date: null,
        min_budget: 5,
        max_budget: -1,
        currency: 'EUR'
    };
    static intents = {
        GREET: 'GREET',
        BYE: 'BYE',
        GET_COUNTRY: 'GET_COUNTRY',
        GET_CITY: 'GET_CITY',
        GET_PURPOSE: 'GET_PURPOSE',
        GET_PEOPLE: 'GET_PEOPLE',
        GET_ROOMS: 'GET_ROOMS',
        GET_CHECK_IN_DATE: 'GET_CHECK_IN_DATE',
        GET_OVERNIGHTS: 'GET_OVERNIGHTS',
        GET_MIN_BUDGET: 'GET_MIN_BUDGET',
        GET_MAX_BUDGET: 'GET_MAX_BUDGET',
        GET_HOTEL: 'GET_HOTEL'
    };
    static apiList = {
        COUNTRIES: {
            URL: 'https://restcountries.eu/rest/v2/all'
        },
        CITIES: {
            URL: 'https://countriesnow.space/api/v0.1/countries/cities'
        }
    };
    static allowedIntents = {
        GREET: ['hi', 'howdy', 'greetings', 'hello'],
        BYE: ['bye', 'cya', 'end'],
        HELP: ['help'],
        THANK_YOU: ['thanks', 'thank you'],
        GET_COUNTRY: ['travel', 'i want to go somewhere'],
        GET_PURPOSE: ['business', 'leisure']
    };

    static async generateResponseAI(qsm) {
        // Train and save the mode
        return new Promise(async (resolve, reject) => {
            const response = await this.getIntent(qsm);
            resolve(response);
        })
    }

    static async getIntent(userIntentRaw) {
        return new Promise(async (resolve) => {
            let userIntent = userIntentRaw.toLowerCase();
            let tokenizedIntent = tokenizer.tokenize(userIntent);
            console.log('Tokenized intent', tokenizedIntent);

            switch (true) {
                case this.checkIfIntentValid(tokenizedIntent, this.allowedIntents.GREET):
                    resolve({answer: 'Howdy! :)'});
                    break;
                case this.checkIfIntentValid(tokenizedIntent, this.allowedIntents.BYE):
                    this.resetState();
                    resolve({answer: 'Bye! :)'});
                    break;
                case this.checkIfIntentValid(tokenizedIntent, this.allowedIntents.THANK_YOU):
                    resolve({answer: 'You are most welcome! :)'});
                    break;
                case this.checkIfIntentValid(tokenizedIntent, this.allowedIntents.GET_COUNTRY):
                    let countries = await this.getCountryList();
                    this.updateState({current_intent: this.intents.GET_COUNTRY, countries});
                    resolve({answer: 'Which country are you going to travel to?\n' + countries.map(({name}) => name).join('\n')});

                    break;
                case this.checkIfIntentValid(tokenizedIntent, this.allowedIntents.HELP):
                    resolve({answer: 'I can help you with following commands:\n \t1. I want to travel.'});
                    break;
                case this.state.current_intent === this.intents.GET_COUNTRY:
                    if (!this.state.countries.length) {
                        this.state.countries = await this.getCountryList();
                    }

                    let countriesLowerCase = this.state.countries.map(({name}) => name.toLowerCase());

                    if (!countriesLowerCase.includes(userIntent)) {
                        resolve({answer: 'Incorrect country name. Please give a valid name.'});
                        return;
                    }

                    let country = userIntentRaw;
                    let cities = await this.getCountryCities(country);
                    resolve({answer: `Which is the city that you are going to visit in ${country}?\n` + cities.join('\n')});
                    this.updateState({
                        current_intent: this.intents.GET_CITY,
                        country: _.find(this.state.countries, {name: country}),
                        cities
                    });
                    break;
                case this.state.current_intent === this.intents.GET_CITY:
                    let citiesLowerCase = this.state.cities.map(city => city.toLowerCase());

                    if (!citiesLowerCase.includes(userIntent)) {
                        resolve({answer: 'Incorrect city name. Please give a valid name.'});
                        return;
                    }

                    let city = userIntentRaw;
                    this.updateState({current_intent: this.intents.GET_PURPOSE, city});
                    resolve({answer: 'Are you travelling for business or leisure?'});
                    break;
                case this.state.current_intent === this.intents.GET_PURPOSE:
                    if (!this.checkIfIntentValid(tokenizedIntent, this.allowedIntents.GET_PURPOSE)) {
                        resolve({answer: 'Incorrect purpose. Please select between Business and Leisure'});
                        return;
                    }

                    this.updateState({current_intent: this.intents.GET_PEOPLE});
                    resolve({answer: 'How many adults and how many kids should I consider for your booking? (separated by ,)'})
                    break;
                case this.state.current_intent === this.intents.GET_PEOPLE:
                    let [adults, children] = tokenizedIntent;
                    adults = +adults || 1;
                    children = +children || 0;

                    this.updateState({
                        current_intent: this.intents.GET_ROOMS,
                        people: {
                            children,
                            adults
                        }
                    });

                    resolve({answer: 'How many rooms would you like me to book for you? (1-9)'});
                    break;
                case this.state.current_intent === this.intents.GET_ROOMS:
                    let [rooms] = tokenizedIntent;
                    rooms = +rooms || 1;

                    if (rooms > 9) {
                        this.updateState({current_intent: this.intents.GET_ROOMS});
                        resolve({answer: 'Incorrect rooms count. Try to pick between 1 and 9.'});
                        return;
                    }

                    this.updateState({current_intent: this.intents.GET_CHECK_IN_DATE, rooms});
                    resolve({answer: 'Please specify your desired check-in date.'});
                    break;
                case this.state.current_intent === this.intents.GET_CHECK_IN_DATE:
                    let checkInDateObj = dayjs(userIntent, this.defaultDateFormat);
                    if (!checkInDateObj.isValid()) {
                        resolve({answer: 'Invalid date. Please use the following format: ' + this.defaultDateFormat});
                        return;
                    }

                    if (checkInDateObj.isBefore(dayjs())) {
                        resolve({answer: 'Invalid date. The check in date is in the past.'});
                        return;
                    }

                    this.updateState({
                        current_intent: this.intents.GET_OVERNIGHTS,
                        check_in_date: checkInDateObj.format(this.defaultDateFormat)
                    });
                    resolve({answer: 'How many overnights are you planning?'})
                    break;
                case this.state.current_intent === this.intents.GET_OVERNIGHTS:
                    let [overnights] = tokenizedIntent;
                    overnights = +overnights || 1;
                    let checkoutDate = dayjs(this.state.check_in_date, this.defaultDateFormat)
                        .add(overnights, 'day')
                        .format(this.defaultDateFormat);

                    this.updateState({check_out_date: checkoutDate, current_intent: this.intents.GET_MIN_BUDGET});
                    resolve({answer: 'Do you have a minimum budget for the price of a room per one night?'});
                    break;
                case this.state.current_intent === this.intents.GET_MIN_BUDGET:
                    let [minBudget] = tokenizedIntent;
                    minBudget = minBudget || 5;

                    this.updateState({min_budget: minBudget, current_intent: this.intents.GET_MAX_BUDGET});
                    resolve({answer: 'And a maximum price range?'});
                    break;
                case this.state.current_intent === this.intents.GET_MAX_BUDGET:
                    let [maxBudget] = tokenizedIntent;
                    maxBudget = maxBudget || 5;

                    this.updateState({max_budget: maxBudget, current_intent: this.intents.GET_HOTEL});
                    let result = await this.getHotels();
                    this.resetState();
                    if (!result) {
                        resolve({answer: "Couldn't find any hotels."});
                        return;
                    }

                    resolve({answer: {text: 'Please find below my suggestions with the top ten available hotels and the overall price for the booking, based on your preferences.', hotels: result}});
                    break;
                default:
                    resolve({});
                    break;
            }

            console.log('State', this.state);
        });
    }

    static getCountryList() {
        return axios.get(this.apiList.COUNTRIES.URL)
            .then(res => res.data.map(({name, alpha2Code}) => ({name, countryCode: alpha2Code})));
    }

    static getCountryCities(country) {
        return axios.post(this.apiList.CITIES.URL, {country})
            .then(res => res.data.error ? false : res.data.data)
            .catch(err => false);
    }

    static getHotels() {
        return amadeus.referenceData.locations.get({
            keyword: this.state.city,
            subType: Amadeus.location.city,
            countryCode: this.state.country.countryCode
        }).then(({data}) => {
            if (!data.length) {
                return false;
            }

            let [location] = data;
            return amadeus.shopping.hotelOffers.get({
                cityCode: location.address.cityCode,
                latitude: location.geoCode.latitude,
                longitude: location.geoCode.longitude,
                // checkInDate: this.state.check_in_date,
                // checkOutDate: this.state.check_out_date,
                roomQuantity: this.state.rooms,
                adults: this.state.people.adults,
                radius: 50,
                radiusUnit: 'KM',
                priceRange: `${this.state.min_budget}-${this.state.max_budget}`,
                currency: this.state.currency,
                bestRateOnly: true,
                view: 'FULL'
            }).then(({data}) => {
                console.log(data);
                return data.length ? data : false
            });
        });

    }

    static checkIfIntentValid(tokenizedIntent, allowedIntents) {
        return _.intersection(tokenizedIntent, allowedIntents).length > 0;
    }

    static updateState(data) {
        this.state = {
            ...this.state,
            ...data
        };
    }

    static resetState() {
        this.state = {
            countries: [],
            country: null,
            cities: [],
            city: null,
            purpose: null,
            current_intent: null,
            people: {
                adults: 1,
                children: 0
            },
            rooms: 1,
            check_in_date: dayjs().format('YYYY-MM-DD'),
            check_out_date: null,
            min_budget: 5,
            max_budget: -1,
            currency: 'EUR'
        };
    }

    static get defaultDateFormat() {
        return 'YYYY-MM-DD';
    }
}

const connectWebSocket = (io) => {
    io.on('connection', function (socket) {
        socket.on('join', (userId) => {
            socket.join(userId);
            console.log("New user joined!")
        });

        socket.on('new-msg', async function (data) {
            let response = await ChatBot.generateResponseAI(data.msg);
            io.to(data.room).emit('send-msg-response', response.answer !== undefined
                ? response.answer : "I am sorry, I don't understand :( ");
        });

    });
}

module.exports = {
    connectWebSocket
}
