import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StarPerformance } from './star-performance';

describe('StarPerformance', () => {
  let component: StarPerformance;
  let fixture: ComponentFixture<StarPerformance>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StarPerformance]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StarPerformance);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
