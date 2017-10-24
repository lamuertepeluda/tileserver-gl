describe('Rendered features', function() {
  it('Should return features at given point', function(done) {
    var test = supertest(app).get('/styles/test-style/11/renderedfeatures' + '?point=8.707351684570312,47.359292508710716');
    test.expect(200);
    test.expect(function(res) {
      res.body.should.have.lengthOf(1);
    });
    test.end(done);
  });
});
