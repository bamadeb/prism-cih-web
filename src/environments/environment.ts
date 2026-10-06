export const environment = {
  production: false,
  cognito: {
    //Dev********************
    // Public app client (PrismWebDevPublic) -- no client secret. Client secrets
    // must never live in this file or in the browser bundle (findings 3.4.5/3.4.8).
    // The previous dev client (PrismWebDev) has been retired in Cognito.
    userPoolId: 'us-east-2_eD7hjiYOG',
    clientId: '3ts8ah2fkmjoa5fesf3e5vg28j',
    region: 'us-east-2',
    //Prod********************
    // Prod must move to a public app client too before it is re-enabled here.
    // userPoolId: 'us-east-1_uG41lZGDN',
    // clientId: '255dglcinonbee6vfv2df57pr9',
    // region: 'us-east-1',
    //MFA******************
    // userPoolId: 'us-east-2_qPglN3d3u',
    // clientId: '7428ve9c4ljr90dlk9afjjo6fu',
    // region: 'us-east-2',
  },

    // apiBaseUrl: 'https://yeuovejy1b.execute-api.us-east-2.amazonaws.com/prod',
    // env: 'prod'
    //    "endpointUrl":"https://e9vakopr4c.execute-api.us-east-1.amazonaws.com/dev/",
    // "envType": "dev"
};
