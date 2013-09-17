'use strict';

angular.module('WikipediaSearchApp')
  .controller('MainCtrl', function ($scope, ejsResource) {
        var ejs = ejsResource('http://localhost:19200');

        var oQuery = ejs.QueryStringQuery().fields(['title^10', 'text'])
            .analyzer('wiki_analyzer')
            .useDisMax(false).defaultOperator('AND');
        var oFilters =
            [
                ejs.MissingFilter('redirect'),
                ejs.MissingFilter('special'),
                ejs.MissingFilter('stub'),
                ejs.MissingFilter('disambiguation')
            ];

        // Paging stuff
        $scope.currentPage = 1;
        $scope.pageSize = 20;
        $scope.numberOfPages = function(){
            return Math.floor($scope.totalResults/$scope.pageSize);
        };

        // Category filtering support
        var activeFilters = {};
        $scope.isActive = function (field, term) {
            return activeFilters.hasOwnProperty(field + term);
        };
        $scope.filter = function(field, term) {
            if ($scope.isActive(field, term)) {
                delete activeFilters[field + term];
            } else {
                activeFilters[field + term] = ejs.TermFilter(field, term);
            }
            $scope.search();
        };
        var getFilters = function() {
            var filters = Object.keys(activeFilters).map(function(k) { return activeFilters[k]; });

            return filters.length > 0 ? ejs.AndFilter(oFilters.concat(filters)) : ejs.AndFilter(oFilters);
        };

        // Where the actual search happens (decleration of it at least)
        var client = ejs.Request()
            .indices('wiki-enwiki')
            .types('wikipage');

        $scope.search = function(page) {
            if (page == null)
                $scope.currentPage = 1;
            else
                $scope.currentPage = page;

            $scope.results = client
                .query(ejs.FilteredQuery(oQuery.query($scope.queryTerm || '*'), getFilters()))
                .highlight(ejs.Highlight(['title', 'text']).type('fast-vector-highlighter'))
                .from(($scope.currentPage - 1) * $scope.pageSize).size($scope.pageSize)

                .facet(ejs.TermsFacet('categories').field('category').size(20).facetFilter(getFilters()))

                .doSearch(function(rsp) { $scope.totalResults = rsp.hits.total; });
        };
  });
