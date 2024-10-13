/* eslint-disable no-undef */
// eslint-disable-next-line no-undef
require('dotenv').config()
const bearer = process.env.BEARER;
const headers = {
  /* Required for CORS support to work */
  'Access-Control-Allow-Origin': '*',
  /* Required for cookies, authorization headers with HTTPS */
  'Access-Control-Allow-Credentials': true
}


exports.handler = async function ({ queryStringParameters }) {

  try{
    const { q: username } = queryStringParameters;
    const socialDataResponse = await fetch(`https://api.socialdata.tools/twitter/user/${username}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${bearer}`,
        'Accept': 'application/json'
      }
    });
    const userData = socialDataResponse.data;
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(userData, null, 2)
    }
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(
        {
          error: 'whoops'
        }, null, 2
      )
    }
  }
  // Instanciate with desired auth type (here's Bearer v2 auth)

}