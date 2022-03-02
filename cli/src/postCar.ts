import fetch from 'node-fetch';

class HTTPResponseError extends Error {
   response: any;

   constructor(response) {
      super(`HTTP Error Response: ${response.status} ${response.statusText}`);
      this.response = response;
   }
}

const checkStatus = response => {
   if (response.ok) {
      return response;
   } else {
      throw new HTTPResponseError(response);
   }
}

export async function postCar(bytes: Uint8Array): Promise<any> {
   var retryCount = 0;
   while (retryCount < 3) {
      try {
         const response = await fetch('https://web3proxy.fly.dev/api/web3/car', {
            method: "post",
            headers: {
               "Content-Type": "application/car"
            },
            body: bytes
         });
         
         try {
            checkStatus(response);
            const json = await response.json();
            return json;
         } catch (error) {
            console.error(error);
            const errorBody = await error.response.text();
            console.error(`Error body: ${errorBody}`);
         }
      } catch (error) {
         console.log(error);
      }
      retryCount++;
   }
   return null;
} 