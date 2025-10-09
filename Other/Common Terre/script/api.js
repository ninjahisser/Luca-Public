const BASE_URL = 'http://127.0.0.1:8000';

export async function fetchAPI(endpoint, method = 'GET', body = null, isFormData = false) {
    const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
    const options = {
        method,
        headers,
        body: isFormData ? body : body ? JSON.stringify(body) : null,
    };

    const response = await fetch(`${BASE_URL}/${endpoint}`, options);
    if (!response.ok) {
        throw { response }; // Throw an error if the response status is not OK
    }

    // Handle cases where the response body might be empty
    try {
        return await response.json();
    } catch (error) {
        return null; // Return null if the response body is empty
    }
}