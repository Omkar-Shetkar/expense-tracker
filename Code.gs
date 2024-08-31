var sheetId = ""; // Your google sheet id. Found in address bar.
var webAppUrl = ""; // Your web app url
var token = ""; // Your Telegram Bot token
var telegramUrl = "https://api.telegram.org/bot" + token;
const GROQ_API_KEY = ""; // Your Groq API Key

function getMe() {
  var url = telegramUrl + "/getMe";
  var response = UrlFetchApp.fetch(url);
  Logger.log(response.getContentText());
}

function doGet(e) {
  return HtmlService.createHtmlOutput("Hi there");
}

function setWebhook() {
  var url = telegramUrl + "/setWebhook?url=" + webAppUrl;
  var response = UrlFetchApp.fetch(url);
  Logger.log(response.getContentText());
}

function handleMessage(message) {
  Logger.log(message);
}

function sendText(id, text) {
  var url =
    telegramUrl +
    "/sendMessage?chat_id=" +
    id +
    "&text=" +
    encodeURIComponent(text);
  var response = UrlFetchApp.fetch(url);
  Logger.log(response.getContentText());
}

function doPost(e) {
  try {
    Logger.log("Received the request: " + e);
    var data = JSON.parse(e.postData.contents);
    var text = data.message.text;
    var id = data.message.chat.id;
    var name = data.message.chat.first_name + " " + data.message.chat.last_name;
    var date = data.message.date;
    date = new Date(date * 1000);
    date = date.toLocaleDateString();

    var answer = LLM(
      date + " --> " + text,
      "JSON document only in ISO/IEC 21778:2017 format. Don't prefix or suffix any other text."
    );

    answer = JSON.parse(answer);

    if (answer.Amount > 0) {
      SpreadsheetApp.openById(sheetId)
        .getSheets()[0]
        .appendRow([
          answer.Date,
          answer.Category,
          answer.Amount,
          answer.Comments,
          answer.Month,
        ]);
      sendText(id, "Saved: " + answer.Amount + " spent for " + answer.Comments);
    }
  } catch (e) {}
}

const SYSTEM_CONTENT = `
  You are my personal expense manager.
You will get input text containing expense details.
You create JSON document with following properties:
Date, Category, Amount, Comments, Month

Here, Date should be today date. If input text contains date, then consider specified date.
Date should be in mm/dd/yyyy format.

Category should be one of the following values: 
Grocery, Home Maintenance, Entertainment, Learn, Gadgets, Medical, Child Education, Travel, Clothing, and Others. 
Infer the category from the input text. 

Grocery: Apart from grocery items, any food, drink items come under Grocery category.
Home Maintenance: Among others rental amount, water bill, current bill etc.
Entertainment: 
Learn: Any learning items including reading and writing materials such as newspapers, magazines, books, etc.
Gadgets: 
Medical: 
Child Education: 
Travel: Among other travel items including transportation expenses
Clothing:
Others: If not able to infer the category, use 'Others' as the value.

Any description about the expense needs to be considerd as Comments.
Do not include price and time details in the comments section.
You can make comments interesting by including suitable emojis, if available.

Infer the Month value from the Date field. Month value should be first three characters of the month. Eg., Jan, Feb, Mar etc.
For date, 30/06/2024 month is 06 which is for Jun

Input text may contain Date, Amount, and Comments in any order.
Normally, it will be price rather than count of items purchased in the comments.
 Infer with best effort.
For invalid input or insufficient data, return empty JSON object.

Remember, output should be in JSON format according to the format ISO/IEC 21778:2017.

Format:
Eg., 
{
  "Date": "08/31/2024", // Always a date string
  "Category": "Grocery", // One among the category listed above
  "Amount": 24, // Always an integer
  "Comments": "orange juice", // Descriptive text
  "Month": "Aug" // first 3 character Month name
}

  `;

/**
 * Retrieves the saved OpenAI API key from the script properties.
 * @returns {string} The saved OpenAI API key, or an empty string if none is set.
 */
function getApiKey() {
  const apiKey = PropertiesService.getScriptProperties().getProperty(
    SETTINGS_PROPERTY_STORE
  );
  return apiKey && apiKey !== "" ? apiKey : "";
}

/**
 * Custom function to send a request to the OpenAI API.
 * @param {string} inputText The text to send to the API.
 * @param {string} prompt The prompt to use.
 * @param {string=} model The model to use (default: 'llama3-8b-8192').
 * @param {string=} temperature The temperature to use, lower is more precise, higher is more creative (default: '0.1').
 * @returns {string} The response from the OpenAI API.
 * @customfunction
 */
function LLM(inputText, prompt, model = "llama3-8b-8192", temperature = 0) {
  const apiKey = GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OpenAI API key not set. Please visit the "LLM > Settings" menu to set your API key.'
    );
  }

  const options = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    method: "POST",
    payload: JSON.stringify({
      model: model,
      messages: [
        {
          role: "system",
          content: SYSTEM_CONTENT,
        },
        {
          role: "user",
          content: `${prompt}\n\n${inputText}`,
        },
      ],
      temperature: temperature,
    }),
  };

  const response = UrlFetchApp.fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    options
  );
  const json = JSON.parse(response.getContentText());
  return json.choices[0].message.content;
}
