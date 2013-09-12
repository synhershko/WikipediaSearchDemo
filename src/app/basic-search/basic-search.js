var basicSearchModule = angular.module( 'ngBoilerplate.basic-search', [
    'ui.state',
    'titleService',
    'plusOne'
]);

basicSearchModule.config(function config( $stateProvider ) {
    $stateProvider.state( 'basic-search', {
        url: '/basic-search',
        views: {
            "main": {
                controller: 'BasicSearchCtrl',
                templateUrl: 'basic-search/basic-search.tpl.html'
            }
        }
    });
});

basicSearchModule.controller( 'BasicSearchCtrl', function HomeController( $scope, titleService, ejsResource ) {
    titleService.setTitle( 'Basic Search ' );

    var ejs = ejsResource('http://localhost:9200');

    var oQuery = ejs.QueryStringQuery().defaultField('text');

    var client = ejs.Request()
        .indices('wiki-enwiki')
        .types('wikipage');

    $scope.search = function() {
        $scope.results = client
            .query(oQuery.query($scope.queryTerm || '*'))
            .doSearch();
    };
});