'use strict';

angular.module('WikipediaSearchApp')
  .controller('MainCtrl', function ($scope, ejsResource) {
        var ejs = ejsResource('http://localhost:19200');

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

        $scope.currentPage = 1;
        $scope.pageSize = 20;

        $scope.numberOfPages = function(){
            return Math.floor($scope.totalResults/$scope.pageSize);
        };

        $scope.search = function(page) {
            if (page == null)
                $scope.currentPage = 1;
            else
                $scope.currentPage = page;

            $scope.results = client
                .query(oQuery.query($scope.queryTerm || '*'))
                .filter(oFilter)
                .highlight(ejs.Highlight(['title', 'text']).type('fast-vector-highlighter'))
                .from(($scope.currentPage - 1) * $scope.pageSize).size($scope.pageSize)
                .doSearch(function(rsp) { $scope.totalResults = rsp.hits.total; });
        };
  });
