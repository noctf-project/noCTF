// import Router from "@koa/router";

// const pbac = (permission: string): Router.Middleware => {
//   return async (ctx, next) => {

//     if (!ctx.auth) {
//       // handle auth.public.login. without this, no-one will be able to login.
//       if (permission === 'auth.public.login') {
//         await next();
//         return;
//       }
//     }

//     ctx.status = 403;
//     ctx.body = {
//       error: 'Forbidden'
//     };
//   };
// };

// export default pbac;
