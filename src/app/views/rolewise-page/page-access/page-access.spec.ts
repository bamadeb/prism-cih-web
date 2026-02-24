import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PageAccess } from './page-access';

describe('PageAccess', () => {
  let component: PageAccess;
  let fixture: ComponentFixture<PageAccess>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageAccess]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PageAccess);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
