'use strict';

angular.module('WikipediaSearchApp', [ 'ngSanitize', 'elasticjs.service' ])
  .config(function ($routeProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'views/main.html',
        controller: 'MainCtrl'
      })
      .otherwise({
        redirectTo: '/'
      });
  });
