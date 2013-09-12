var basicSearchModule = angular.module( 'ngBoilerplate.basic-search', [
    'ui.state',
    'titleService',
    'plusOne',
    'ngSanitize'
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

    var oQuery = ejs.QueryStringQuery().fields(['title^10', 'text'])
        .analyzer('wiki_analyzer')
        .useDisMax(false).defaultOperator('AND');
    var oFilter = ejs.AndFilter(
        [
            ejs.MissingFilter('redirect'),
            ejs.MissingFilter('special'),
            ejs.MissingFilter('stub'),
            ejs.MissingFilter('disambiguation')
        ]
    );

    var client = ejs.Request()
        .indices('wiki-enwiki')
        .types('wikipage');

    $scope.search = function() {
        $scope.results = client
            .query(oQuery.query($scope.queryTerm || '*'))
            .filter(oFilter)
            .highlight(ejs.Highlight('text', 'title').type('fast-vector-highlighter'))
            .doSearch();
    };
});